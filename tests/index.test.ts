import validateDependencies from '../src'

import { createFile } from './testUtils'
import { withMonorepoContext } from './setupMonorepo'

describe('GhostImports', () => {
    describe('High-level use cases (single project)', () => {
        it('detects require imports correctly', async () =>
            await withMonorepoContext(
                {
                    root: { dependencies: ['pkg-1', 'pkg-3'] },
                    'pkg-1': {},
                    'pkg-3': {},
                },
                async (projectRoot) => {
                    await createFile(
                        projectRoot,
                        'index.js',
                        `
                         const { foo } = require("pkg-1")
                         const { bar } = require("pkg-2")

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: projectRoot,
                    })

                    expect(report.undeclaredDependencies.get('root')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(report.unusedDependencies.get('root')).toEqual(
                        new Set(['pkg-3']),
                    )
                },
            ))

        it('produces report when no undeclared dependencies', async () =>
            await withMonorepoContext(
                {
                    root: { dependencies: ['pkg-1'] },
                    'pkg-1': {},
                },
                async (projectRoot) => {
                    await createFile(
                        projectRoot,
                        'index.js',
                        `
                         import { foo } from "pkg-1"

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: projectRoot,
                    })

                    expect(
                        report.undeclaredDependencies.get('root')?.size,
                    ).toEqual(0)
                    expect(report.unusedDependencies.get('root')?.size).toEqual(
                        0,
                    )
                },
            ))

        it('produces report when undeclared dependencies are present', async () =>
            await withMonorepoContext(
                {
                    root: { dependencies: ['pkg-1'] },
                    'pkg-1': {},
                },
                async (projectRoot) => {
                    await createFile(
                        projectRoot,
                        'index.js',
                        `
                         import { foo } from "pkg-1"
                         import { bar } from "pkg-2"

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: projectRoot,
                    })

                    expect(report.undeclaredDependencies.get('root')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(report.unusedDependencies.get('root')?.size).toEqual(
                        0,
                    )
                },
            ))

        it('produces report when unused dependencies are present', async () =>
            await withMonorepoContext(
                {
                    root: { dependencies: ['pkg-1', 'pkg-2'] },
                    'pkg-1': {},
                    'pkg-2': {},
                },
                async (projectRoot) => {
                    await createFile(
                        projectRoot,
                        'index.js',
                        `
                     import { foo } from "pkg-1"

                     foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: projectRoot,
                    })

                    expect(report.unusedDependencies.get('root')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(
                        report.undeclaredDependencies.get('root')?.size,
                    ).toEqual(0)
                },
            ))
    })

    describe('High-level use cases (monorepo)', () => {
        it('produces report with correct package analysis', async () =>
            await withMonorepoContext(
                {
                    root: {},
                    'pkg-1': {},
                    'pkg-2': { dependencies: ['pkg-1'] },
                    'pkg-3': {},
                },
                async (projectRoot) => {
                    await createFile(
                        `${projectRoot}/packages/pkg-3/`,
                        'index.js',
                        `
                     import { foo } from "pkg-1"

                     foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: projectRoot,
                    })

                    expect(
                        report.unusedDependencies.get('pkg-1')?.size,
                    ).toEqual(0)
                    expect(report.unusedDependencies.get('pkg-2')).toEqual(
                        new Set(['pkg-1']),
                    )
                    expect(
                        report.unusedDependencies.get('pkg-3')?.size,
                    ).toEqual(0)

                    expect(
                        report.undeclaredDependencies.get('pkg-1')?.size,
                    ).toEqual(0)
                    expect(
                        report.undeclaredDependencies.get('pkg-2')?.size,
                    ).toEqual(0)
                    expect(report.undeclaredDependencies.get('pkg-3')).toEqual(
                        new Set(['pkg-1']),
                    )
                },
            ))
    })
})
