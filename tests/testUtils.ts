import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'

export const TEST_PACKAGE_NAME = 'testpackage'

export async function cleanUp(paths: string[]): Promise<void> {
    await Promise.all(
        paths.map(async (tempPath) =>
            fs.rmdir(tempPath, { recursive: true, force: true }),
        ),
    )
}

export async function prepareTempDirectory(
    cwd?: string,
    packageName?: string,
): Promise<string> {
    let tempRoot
    if (cwd) tempRoot = cwd
    else tempRoot = await fs.mkdtemp(`${tmpdir()}/`)

    // A lockfile is needed, but its content don't matter.
    await createFile(tempRoot, 'yarn.lock', '')

    const packageJsonTemplate = {
        name: packageName ?? TEST_PACKAGE_NAME,
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

export async function prepareTempMonorepoDirectory(): Promise<Set<string>> {
    const tempRoot = await fs.mkdtemp(`${tmpdir()}/`)

    // A lockfile is needed, but its content don't matter.
    await createFile(tempRoot, 'yarn.lock', '')

    const packageJsonTemplate = {
        name: TEST_PACKAGE_NAME,
        private: true,
        workspaces: ['packages/*'],
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

    const createdPaths = [tempRoot]
    const subPackages = ['mono1', 'mono2', 'mono3']
    await Promise.all(
        subPackages.map(async (packageName) => {
            const packagePath = await prepareTempDirectory(
                `${tempRoot}/packages/${packageName}`,
                packageName,
            )
            createdPaths.push(packagePath)
        }),
    )
    return new Set(createdPaths)
}
export async function declareDependencies(
    cwd: string,
    dependencies: Map<string, string>,
): Promise<string> {
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

export async function readFile(path: string): string {
    return fs.readFile(path, { encoding: 'utf8' })
}

export async function createFile(
    cwd: string,
    path: string,
    data: string,
): Promise<string> {
    const filePath = resolve(cwd, path)
    const parentDirectory = dirname(filePath)

    await fs.mkdir(parentDirectory, { recursive: true })
    await fs.writeFile(filePath, data, { encoding: 'utf8' })

    return filePath
}
