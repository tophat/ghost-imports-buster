module.exports = {
    parser: "@typescript-eslint/parser",
    extends: [
        "plugin:@typescript-eslint/recommended",
        "@tophat/eslint-config/base",
        "@tophat/eslint-config/jest",
    ],
    rules: {
        '@typescript-eslint/member-delimiter-style': 0
    },
    settings: {
        "import/resolver": {
            "node": {
                "extensions": [".ts", ".js"]
            }
        }
    }
}
