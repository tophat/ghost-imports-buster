import {
    TEST_PACKAGE_NAME,
    cleanUp,
    createFile,
    declareDependencies,
    prepareTempDirectory,
    prepareTempMonorepoDirectory,
} from './testUtils'

import validateDependencies from '.'

describe('GhostImports', () => {
    describe('High-level use cases (single project)', () => {
        let workspacePath

        beforeEach(async () => {
            workspacePath = await prepareTempDirectory()
        })

        afterEach(async () => {
            await cleanUp(workspacePath)
        })

        it('detects require imports correctly', async () => {
            const cwd = workspacePath
            const dependencies = new Map([
                ['pkg-1', 'prod'],
                ['pkg-3', 'prod'],
            ])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     const { foo } = require("pkg-1")
                     const { bar } = require("pkg-2")

                     foo()`,
            )
            const report = await validateDependencies({ cwd })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME),
            ).toEqual(new Set(['pkg-2']))
            expect(report.unusedDependencies.get(TEST_PACKAGE_NAME)).toEqual(
                new Set(['pkg-3']),
            )
        })

        it('produces report when no undeclared dependencies', async () => {
            const cwd = workspacePath
            const dependencies = new Map([['pkg-1', 'prod']])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     import { foo } from "pkg-1"

                     foo()`,
            )
            const report = await validateDependencies({ cwd })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
            expect(
                report.unusedDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
        })

        it('produces report when undeclared dependencies are present', async () => {
            const cwd = workspacePath
            const dependencies = new Map([['pkg-1', 'prod']])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     import { foo } from "pkg-1"
                     import { bar } from "pkg-2"

                     foo()`,
            )
            const report = await validateDependencies({ cwd })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME),
            ).toEqual(new Set(['pkg-2']))
            expect(
                report.unusedDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
        })

        it('produces report when unused dependencies are present', async () => {
            const cwd = workspacePath
            const dependencies = new Map([
                ['pkg-1', 'prod'],
                ['pkg-2', 'prod'],
            ])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     import { foo } from "pkg-1"

                     foo()`,
            )
            const report = await validateDependencies({ cwd })

            expect(report.unusedDependencies.get(TEST_PACKAGE_NAME)).toEqual(
                new Set(['pkg-2']),
            )
            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
        })
    })

    describe('High-level use cases (monorepo)', () => {
        let workspacePath
        let packagesPaths

        beforeEach(async () => {
            const createdPaths = await prepareTempMonorepoDirectory()
            workspacePath = [...createdPaths][0]
            packagesPaths = [...createdPaths].slice(1).sort()
        })

        afterEach(async () => {
            await cleanUp(workspacePath)
        })

        it('produces report with correct package analysis', async () => {
            const cwd = workspacePath
            const dependenciesMono1 = new Map([['pkg-1', 'prod']])
            const dependenciesMono3 = new Map()
            await declareDependencies(packagesPaths[0], dependenciesMono1)
            await declareDependencies(packagesPaths[2], dependenciesMono3)
            await createFile(
                packagesPaths[2],
                'index.js',
                `
                     import { foo } from "pkg-1"

                     foo()`,
            )
            const report = await validateDependencies({ cwd })
            expect(report.unusedDependencies.get('mono1')).toEqual(
                new Set(['pkg-1']),
            )
            expect(report.unusedDependencies.get('mono2').size).toEqual(0)
            expect(report.unusedDependencies.get('mono3').size).toEqual(0)

            expect(report.undeclaredDependencies.get('mono1').size).toEqual(0)
            expect(report.undeclaredDependencies.get('mono2').size).toEqual(0)
            expect(report.undeclaredDependencies.get('mono3')).toEqual(
                new Set(['pkg-1']),
            )
        })
    })
})
