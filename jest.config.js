module.exports = {
    roots: ['<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)',
    ],
    transform: {
        '^.+\\.(ts|tsx)?$': 'babel-jest',
    },
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageDirectory: './coverage',
}
