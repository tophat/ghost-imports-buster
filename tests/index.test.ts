import validateDependencies from '../src'

import { createFile, withDirectoryContext } from './testUtils'

describe('GhostImports', () => {
    describe('High-level use cases (single project)', () => {
        it('detects require imports correctly', async () =>
            withDirectoryContext(
                {
                    pkg: { dependencies: { 'pkg-1': '*', 'pkg-3': '*' } },
                },
                async (projectRoot) => {
                    const packageRoot = `${projectRoot}/pkg/`
                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                         const { foo } = require("pkg-1")
                         const { bar } = require("pkg-2")

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })

                    expect(report.undeclaredDependencies.get('pkg')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(report.unusedDependencies.get('pkg')).toEqual(
                        new Set(['pkg-3']),
                    )
                },
            ))

        it('produces report when no undeclared dependencies', async () =>
            withDirectoryContext(
                {
                    pkg: { dependencies: { 'pkg-1': '*' } },
                },
                async (projectRoot) => {
                    const packageRoot = `${projectRoot}/pkg`
                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                         import { foo } from "pkg-1"

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })

                    expect(
                        report.undeclaredDependencies.get('pkg')?.size,
                    ).toEqual(0)
                    expect(report.unusedDependencies.get('pkg')?.size).toEqual(
                        0,
                    )
                },
            ))

        it('produces report when undeclared dependencies are present', async () =>
            withDirectoryContext(
                {
                    pkg: { dependencies: { 'pkg-1': '*' } },
                },
                async (projectRoot) => {
                    const packageRoot = `${projectRoot}/pkg`

                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                         import { foo } from "pkg-1"
                         import { bar } from "pkg-2"

                         foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })

                    expect(report.undeclaredDependencies.get('pkg')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(report.unusedDependencies.get('pkg')?.size).toEqual(
                        0,
                    )
                },
            ))

        it('produces report when unused dependencies are present', async () =>
            withDirectoryContext(
                {
                    pkg: { dependencies: { 'pkg-1': '*', 'pkg-2': '*' } },
                },
                async (projectRoot) => {
                    const packageRoot = `${projectRoot}/pkg`
                    await createFile(
                        packageRoot,
                        'index.js',
                        `
                     import { foo } from "pkg-1"

                     foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: packageRoot,
                    })

                    expect(report.unusedDependencies.get('pkg')).toEqual(
                        new Set(['pkg-2']),
                    )
                    expect(
                        report.undeclaredDependencies.get('pkg')?.size,
                    ).toEqual(0)
                },
            ))
    })

    describe('High-level use cases (monorepo)', () => {
        it('produces report with correct package analysis', async () =>
            withDirectoryContext(
                {
                    root: { workspaces: ['packages/*'], private: true },
                    'pkg-1': {},
                    'pkg-2': { dependencies: { 'pkg-1': '*' } },
                    'pkg-3': {},
                },
                async (projectRoot) => {
                    await createFile(
                        `${projectRoot}/root/packages/pkg-3/`,
                        'index.js',
                        `
                     import { foo } from "pkg-1"

                     foo()`,
                    )
                    const report = await validateDependencies({
                        cwd: `${projectRoot}/root/`,
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
