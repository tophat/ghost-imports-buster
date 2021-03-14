import validateDependencies from '../src'

import { createFile, withMonorepoContext } from './testUtils'

describe('Configuration', () => {
    describe('via config file', () => {
        it('includes can be supplied via config file', async () =>
            await withMonorepoContext(
                {
                    root: {},
                    'pkg-1': { dependencies: ['pkg-2'] },
                    'pkg-2': {},
                },
                async (tempRoot) => {
                    const packageRoot = `${tempRoot}/packages/pkg-1/`
                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                     const { foo } = require("pkg-2")
                     foo()`,
                    )
                    await createFile(
                        packageRoot,
                        'ghost-imports.config.js',
                        `
                module.exports = {
                    includeFiles: ["**/index.js"]
                }
                    `,
                    )

                    // The includelist includes the file above, pkg-1 is declared and used.
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })
                    console.log(report)
                    if (!report) throw new Error('No report produced')
                    expect(
                        report.undeclaredDependencies?.get('pkg-1')?.size,
                    ).toEqual(0)
                    expect(
                        report.unusedDependencies.get('pkg-1')?.size,
                    ).toEqual(0)
                },
            ))
        it('excludes can be supplied via config file', async () =>
            await withMonorepoContext(
                {
                    root: {},
                    'pkg-1': { dependencies: ['pkg-2'] },
                    'pkg-2': {},
                },
                async (tempRoot) => {
                    const packageRoot = `${tempRoot}/packages/pkg-1/`
                    // This file will be excluded and ignored.
                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                     const { foo } = require("pkg-2")
                     foo()`,
                    )
                    await createFile(
                        packageRoot,
                        'ghost-imports.config.js',
                        `
                module.exports = {
                    excludeFiles: ["**/index.js"]
                }
                    `,
                    )

                    // The includelist includes the file above, pkg-1 is declared and used.
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })
                    console.log(report)
                    if (!report) throw new Error('No report produced')
                    expect(
                        report.undeclaredDependencies?.get('pkg-1')?.size,
                    ).toEqual(0)
                    expect(report.unusedDependencies.get('pkg-1')).toEqual(
                        new Set(['pkg-2']),
                    )
                },
            ))
    })

    it('excludes specified "excluded" globs', async () =>
        await withMonorepoContext(
            {
                root: {},
                'pkg-1': { dependencies: ['pkg-2'] },
                'pkg-2': {},
            },
            async (tempRoot) => {
                const packageRoot = `${tempRoot}/packages/pkg-1/`
                await createFile(
                    packageRoot,
                    'index.js',
                    `
                     const { foo } = require("pkg-2")
                     foo()`,
                )
                // The includelist includes the file above, pkg-1 is declared and used.
                const report = await validateDependencies({
                    cwd: packageRoot,
                    excludeFiles: ['**/index.js'],
                })

                if (!report) throw new Error('No report produced')
                expect(
                    report.undeclaredDependencies?.get('pkg-1')?.size,
                ).toEqual(0)
                expect(report.unusedDependencies.get('pkg-1')?.size).toEqual(1)
            },
        ))

    it('includes everything if no glob is given', async () =>
        await withMonorepoContext(
            {
                root: {},
                'pkg-1': { dependencies: ['pkg-2'] },
                'pkg-2': {},
            },
            async (tempRoot) => {
                const packageRoot = `${tempRoot}/packages/pkg-1/`
                await createFile(
                    packageRoot,
                    'index.js',
                    `
                     const { foo } = require("pkg-2")
                     foo()`,
                )
                // The includelist includes the file above, pkg-1 is declared and used.
                const report = await validateDependencies({
                    cwd: packageRoot,
                })

                if (!report) throw new Error('No report produced')
                expect(
                    report.undeclaredDependencies?.get('pkg-1')?.size,
                ).toEqual(0)
                expect(report.unusedDependencies.get('pkg-1')?.size).toEqual(0)
            },
        ))

    it('includes specified "included" globs', async () =>
        await withMonorepoContext(
            {
                root: {},
                'pkg-1': { dependencies: ['pkg-2'] },
                'pkg-2': {},
            },
            async (tempRoot) => {
                const packageRoot = `${tempRoot}/packages/pkg-1/`
                await createFile(
                    packageRoot,
                    'index.js',
                    `
                     const { foo } = require("pkg-2")
                     foo()`,
                )
                // The includelist includes the file above, pkg-1 is declared and used.
                const report = await validateDependencies({
                    cwd: packageRoot,
                    includeFiles: ['**/index.js'],
                })

                if (!report) throw new Error('No report produced')
                expect(
                    report.undeclaredDependencies?.get('pkg-1')?.size,
                ).toEqual(0)
                expect(report.unusedDependencies.get('pkg-1')?.size).toEqual(0)
            },
        ))

    it('conflicting globs will exclude the matched results', async () =>
        await withMonorepoContext(
            {
                root: {},
                'pkg-1': { dependencies: ['pkg-2'] },
                'pkg-2': {},
            },
            async (tempRoot) => {
                const packageRoot = `${tempRoot}/pkg-1/`
                await createFile(
                    packageRoot,
                    'index.js',
                    `
                     const { foo } = require("pkg-2")
                     foo()`,
                )
                // The includelist includes the file above, pkg-1 is declared and used.
                const report = await validateDependencies({
                    cwd: packageRoot,
                    includeFiles: ['**/index.js'],
                    excludeFiles: ['**/index.js'],
                })

                if (!report) throw new Error('No report produced')
                expect(
                    report.undeclaredDependencies?.get('pkg-1')?.size,
                ).toEqual(0)
                expect(report.unusedDependencies.get('pkg-1')?.size).toEqual(1)
            },
        ))
})
