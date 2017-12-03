const express = require('express');
const pgp = require("pg-promise")();
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const db = pgp(process.env.DATABASE_URL || "postgres://localhost:5432/savy", { "ssl": true });

const operations = require('./services/operations')(db);
const AUTH_KEY = process.env.AUTH_KEY || 'savy';

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    if (req.headers['x-authentication'] !== AUTH_KEY) {
        res.status(401).end();
    } else {
        next();
    }
});

app.get('/', (req, res) => res.json('Savy 1.0'));


app.get('/budgets', (req, res) => {
    operations.getBudgeted()
        .then(budgets => res.json({ budgets }))
        .catch(err => console.log('[APP] Budgets failed', err))
});

app.post('/budgets', (req, res) => {
    const { label, amount } = req.body;

    if (!label || !amount) {
        res.status(422).json({ "error": "missing_parameters" });
    }

    operations.saveBudget(label, amount)
        .then(() => {
            operations.getBudgeted()
                .then(budgets => res.json({ budgets }))
                .catch(err => res.status(500).json({ "error": "could_not_get_budgets" }))
        })
        .catch(err => res.status(500).json({ "error": "could_not_create_budget" }));
});

app.delete('/budgets/:id', (req, res) => {
    operations.deleteBudget(req.params.id)
        .then(() => {
            operations.getBudgeted()
                .then(budgets => res.json({ budgets }))
                .catch(err => res.status(500).json({ "error": "could_not_get_budgets" }))
        })
        .catch(err => res.status(500).json({ "error": "could_not_delete_budget" }));
});


app.post('/transfer-budgets', (req, res) => {
    operations.transferBudgets()
        .then(operations.getAllForCurrentMonth()
            .then(operations => res.json({ operations }))
            .catch(err => res.status(500).json({ "error": "could_not_get_all_month_operations" })));
});


app.get('/operations/current-month', (req, res) => {
    operations.getAllForCurrentMonth()
        .then(operations => res.json({ operations }))
        .catch(err => console.log('[APP] Current month operations: failed'));
});

app.post('/operations', (req, res) => {
    const { label, amount, status } = req.body;

    if (!label || !amount) {
        res.status(422).json({ "error": "missing_parameters" });
    }

    operations.save(label, amount, status)
        .then(() => {
            operations.getAllForCurrentMonth()
                .then(operations => res.json({ operations }))
                .catch(err => res.status(500).json({ "error": "could_not_get_all_month_operations" }))
        })
        .catch(err => console.log('[APP] Save: failed', err));
});

app.patch('/operations/:id', (req, res) => {
    const { status } = req.body;

    if (!status) {
        res.status(422).json({ error: "missing_parameters" });
    }

    operations.updateStatus(req.params.id, status)
        .then(() => {
            operations.getAllForCurrentMonth()
                .then(operations => res.json({ operations }))
                .catch(err => res.status(500).json({ "error": "could_not_get_all_month_operations" }))
        })
        .catch(err => res.status(500).json({ "error": "could_not_delete_operation" }));
});

app.delete('/operations/:id', (req, res) => {
    operations.delete(req.params.id)
        .then(() => {
            operations.getAllForCurrentMonth()
                .then(operations => res.json({ operations }))
                .catch(err => res.status(500).json({ "error": "could_not_get_all_month_operations" }))
        })
        .catch(err => res.status(500).json({ "error": "could_not_delete_operation" }));
});


app.get('/summary', (req, res) => {
    operations.getSummary()
        .then(summary => res.json({ summary }))
        .catch(err => console.log('[APP] Summary: could not get current month summary'));
});

app.listen(process.env.PORT || 8080, () => console.log('[APP] Started'));