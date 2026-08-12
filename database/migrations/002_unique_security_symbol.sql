CREATE UNIQUE INDEX securities_symbol_ci
    ON securities (lower(symbol));
