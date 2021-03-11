import validateDependencies from '../src'

import {
    TEST_PACKAGE_NAME,
    cleanUp,
    createFile,
    declareDependencies,
    prepareTempDirectory,
    prepareTempMonorepoDirectory,
    readFile,
} from './testUtils'

describe('GhostImports', () => {
    describe('Configuration', () => {
        let workspacePath

        beforeEach(async () => {
            workspacePath = await prepareTempDirectory()
        })

        afterEach(async () => {
            await cleanUp([workspacePath])
        })

        it('excludes specified "excluded" globs', async () => {
            const cwd = workspacePath
            const dependencies = new Map([['pkg-1', 'prod']])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     const { foo } = require("pkg-1")
                     const { bar } = require("pkg-2")

                     foo()`,
            )
            // The excludelist ignores the file above, pkg-1 is unused.
            const report = await validateDependencies({
                cwd,
                exclude: ['**/index.js'],
            })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
            expect(report.unusedDependencies.get(TEST_PACKAGE_NAME)).toEqual(
                new Set(['pkg-1']),
            )
        })

        it('includes specified "included" globs', async () => {
            const cwd = workspacePath
            const dependencies = new Map([['pkg-1', 'prod']])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     const { foo } = require("pkg-1")

                     foo()`,
            )
            // The includelist includes the file above, pkg-1 is declared and used.
            const report = await validateDependencies({
                cwd,
                include: ['**/index.js'],
            })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
            expect(
                report.unusedDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
        })

        it('conflicting globs will exclude the matched results', async () => {
            const cwd = workspacePath
            const dependencies = new Map([['pkg-1', 'prod']])
            await declareDependencies(cwd, dependencies)
            await createFile(
                cwd,
                'index.js',
                `
                     const { foo } = require("pkg-1")

                     foo()`,
            )
            // The file above is both included and exclude, it gets ignored.
            const report = await validateDependencies({
                cwd,
                exclude: ['**/index.js'],
                include: ['**/index.js'],
            })

            expect(
                report.undeclaredDependencies.get(TEST_PACKAGE_NAME).size,
            ).toEqual(0)
            expect(report.unusedDependencies.get(TEST_PACKAGE_NAME)).toEqual(
                new Set(['pkg-1']),
            )
        })
    })

    describe('High-level use cases (single project)', () => {
        let workspacePath

        beforeEach(async () => {
            workspacePath = await prepareTempDirectory()
        })

        afterEach(async () => {
            await cleanUp([workspacePath])
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
            await cleanUp([workspacePath])
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

    describe('autofixing', () => {
        let tempPaths

        beforeEach(async () => {
            const createdPath = await prepareTempDirectory()
            tempPaths = [createdPath]
        })

        afterEach(async () => {
            await cleanUp(tempPaths)
        })
        it('resolves versions correct from node_modules if available', async () => {
            const undeclaredPackageJson = {
                version: '1.2.3',
                name: 'pkg-1',
            }
            await createFile(
                '/tmp',
                'node_modules/pkg-1/package.json',
                JSON.stringify(undeclaredPackageJson),
            )

            await createFile(
                tempPaths[0],
                'index.js',
                `
                     import { foo } from "pkg-1"

                     foo()`,
            )

            await validateDependencies({ cwd: tempPaths[0], fix: true })
            const manifest = await readFile(`${tempPaths[0]}/package.json`)
            const parsedManifest = JSON.parse(manifest)

            expect(parsedManifest.dependencies).toEqual({
                [undeclaredPackageJson.name]: `^${undeclaredPackageJson.version}`,
            })
        })
    })
})
