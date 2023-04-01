module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "overrides": [
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "@typescript-eslint"
    ],
    "rules": {
        // There are a lot of anys in the d3 types.
        "@typescript-eslint/no-explicit-any": "off",
        // Old-style DOM manipulation has a lot of Maybes.
        "@typescript-eslint/no-non-null-assertion": "off"

    }
}
