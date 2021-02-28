import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import validateDependencies from '.'

const TEST_PACKAGE_NAME = 'testpackage'

async function prepareTempDirectory(): Promise<string> {
    const tempRoot = await fs.mkdtemp(`${tmpdir()}/`)

    // A lockfile is needed, but its content don't matter.
    await createFile(tempRoot, 'yarn.lock', '')

    const packageJsonTemplate = {
        name: TEST_PACKAGE_NAME,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
    }
    // Basic package.json without dependencies
    await createFile(
        tempRoot,
        'package.json',
        JSON.stringify(packageJsonTemplate),
    )

    return tempRoot
}

async function declareDependencies(
    cwd: string,
    dependencies: Map<string, string>,
): Promise<Map<string, string>> {
    const currentPackageJson = JSON.parse(
        await fs.readFile(resolve(cwd, 'package.json'), { encoding: 'utf8' }),
    )

    for (const dependency of dependencies.entries()) {
        const [packageName, dependencyClass] = dependency

        if (dependencyClass === 'prod')
            currentPackageJson.dependencies[packageName] = '*'
        else if (dependencyClass === 'dev')
            currentPackageJson.devDependencies[packageName] = '*'
        else if (dependencyClass === 'peer')
            currentPackageJson.peerDependencies[packageName] = '*'
    }

    await createFile(cwd, 'package.json', JSON.stringify(currentPackageJson))

    return currentPackageJson
}

async function createFile(
    cwd: string,
    path: string,
    data: string,
): Promise<string> {
    const filePath = resolve(cwd, path)
    await fs.writeFile(filePath, data, { encoding: 'utf8' })

    return filePath
}

describe('GhostImports', () => {
    let workspacePath

    beforeEach(async () => {
        workspacePath = await prepareTempDirectory()
    })

    afterEach(async () => {
        await fs.rmdir(workspacePath, { recursive: true })
    })
    describe('High-level use cases (single project)', () => {
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
})
