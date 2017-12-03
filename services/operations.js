const moment = require('moment');

const sortWithAbsoluteValue = (operationA, operationB) => {
    if (operationA.amount === operationB.amount) {
        return 0;
    }

    return Math.abs(operationA.amount) > Math.abs(operationB.amount) ? -1 : 1;
};

module.exports = function (db) {
    return {
        getSummary: () => {
            return new Promise((resolve, reject) => {
                db.any('SELECT * FROM operations WHERE extract(month from now()) = extract(month from month)')
                    .then(operations => {
                        const creditsChecked = operations
                            .filter(operation => operation.status === 'checked' && operation.amount >= 0)
                            .reduce((sum, operation) => sum + operation.amount, 0);

                        const creditsPending = operations
                            .filter(operation => operation.status === 'pending' && operation.amount >= 0)
                            .reduce((sum, operation) => sum + operation.amount, 0);

                        const debitsChecked = operations
                            .filter(operation => operation.status === 'checked' && operation.amount < 0)
                            .reduce((sum, operation) => sum + operation.amount, 0);

                        const debitsPending = operations
                            .filter(operation => operation.status === 'pending' && operation.amount < 0)
                            .reduce((sum, operation) => sum + operation.amount, 0);

                        const summary = {
                            credit: {
                                current: creditsChecked,
                                forecast: creditsPending + creditsChecked,
                            },
                            debit: {
                                current: debitsChecked,
                                forecast: debitsChecked + debitsPending,
                            },
                            balance: {
                                current: creditsChecked + debitsChecked,
                                forecast: creditsChecked + creditsPending + debitsChecked + debitsPending
                            },
                            completion: Math.round(moment().date() / moment().daysInMonth() * 100)
                        };

                        resolve(summary);
                    })
                    .catch(err => {
                        reject(err);
                    });
            });
        },
        getAllForCurrentMonth: () => {
            return new Promise((resolve, reject) => {
                db.any('SELECT * FROM operations WHERE extract(month from now()) = extract(month from month) ORDER BY id ASC')
                    .then(operations => {
                        const creditOperations = operations
                            .filter(operation => operation.amount >= 0)
                            .sort(sortWithAbsoluteValue);

                        const debitOperations = operations
                            .filter(operation => operation.amount < 0)
                            .sort(sortWithAbsoluteValue);

                        resolve(creditOperations.concat(debitOperations));
                    })
                    .catch(err => reject(err));
            })
        },
        getBudgeted: () => {
            return new Promise((resolve, reject) => {
                db.any('SELECT * FROM budgets ORDER BY id ASC')
                    .then(budgets => {
                        const creditBudgets = budgets
                            .filter(budget => budget.amount >= 0)
                            .sort(sortWithAbsoluteValue);

                        const debitBudgets = budgets
                            .filter(budget => budget.amount < 0)
                            .sort(sortWithAbsoluteValue);

                        resolve(creditBudgets.concat(debitBudgets));
                    })
                    .catch(err => reject(err));
            });
        },
        save: (label, amount, status = 'pending') => {
            return db.none('INSERT INTO operations(status, label, amount, month) VALUES (${status}, ${label}, ${amount}, ${month})', {
                label,
                amount,
                status,
                month: moment().startOf('month').format('YYYY-MM-DD')
            });
        },
        delete: (id) => {
            return db.none('DELETE FROM operations WHERE id = ${id}', {id});
        },
        updateStatus: (id, status) => {
            return db.none('UPDATE operations SET status = ${status} WHERE id = ${id}', {id, status});
        },
        saveBudget: (label, amount) => {
            return db.none('INSERT INTO budgets (label, amount) VALUES (${label}, ${amount})', {
                label,
                amount
            });
        },
        deleteBudget: (id) => {
            return db.none('DELETE FROM budgets WHERE id = ${id}', {id});
        },
        transferBudgets: () => {
            return db.any('SELECT * FROM budgets')
                .then(budgets => {
                    db.tx(t => {
                        const queries = budgets.map(b => {
                            return t.none('INSERT INTO operations (label, amount, status, month, from_budget) VALUES (${label}, ${amount}, ${status}, ${month}, ${from_budget})', {
                                label: b.label,
                                amount: b.amount,
                                status: 'pending',
                                from_budget: true,
                                month: moment().startOf('month').format('YYYY-MM-DD')
                            });
                        });

                        return t.batch(queries);
                    })
                        .then(data => {
                            //
                        })
                        .catch(error => {
                            //
                        });
                })
                .catch(err => reject(err));
        }
    };
};