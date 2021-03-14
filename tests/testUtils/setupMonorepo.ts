import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import {
    Cache,
    Configuration,
    Project,
    ThrowReport,
    structUtils,
} from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'
import { getPluginConfiguration } from '@yarnpkg/cli'

async function writeJSON(
    filename: string,
    data: Record<string, unknown>,
): Promise<void> {
    await fs.writeFile(filename, JSON.stringify(data), 'utf-8')
}

async function makeDependencyMap(
    packages: Array<string> | Record<string, string>,
): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {}
    if (Array.isArray(packages)) {
        for (const pkg of packages) {
            dependencies[pkg] = `workspace:packages/${
                structUtils.parseIdent(pkg).name
            }`
        }
    } else {
        return packages
    }
    return dependencies
}

type PackageInitConfiguration = Partial<{
    dependencies: Array<string>
    devDependencies: Array<string>
    peerDependencies: Array<string>
    scripts: Record<string, string>
    private: boolean
    version: string
}>

export async function setupMonorepo(
    monorepo: Record<string, PackageInitConfiguration> & {
        root?: Partial<{
            dependencies: Array<string> | Record<string, string>
            devDependencies: Array<string> | Record<string, string>
            repository: string
            name: string
            private: boolean
        }>
    },
): Promise<string> {
    const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monorepo-'))

    const root = monorepo.root

    // Generate root package.json
    await writeJSON(path.join(workingDir, 'package.json'), {
        name: root?.name ?? 'root',
        private: root?.private ?? true,
        version: '1.0.0',
        workspaces: ['packages/*'],
        dependencies: await makeDependencyMap(root?.dependencies ?? {}),
        devDependencies: await makeDependencyMap(root?.devDependencies ?? {}),
        repository: root?.repository,
    })

    // Generate children workspaces
    for (const [pkgName, pkgConfig] of Object.entries(monorepo)) {
        if (pkgName === 'root') continue

        const pkgDir = path.join(
            workingDir,
            'packages',
            structUtils.parseIdent(pkgName).name,
        )
        await fs.mkdir(pkgDir, { recursive: true })

        await writeJSON(path.join(pkgDir, 'package.json'), {
            name: pkgName,
            version: pkgConfig.version ?? '0.0.0',
            private: pkgConfig.private || undefined,
            scripts: pkgConfig.scripts ?? {},
            dependencies: await makeDependencyMap(pkgConfig.dependencies ?? []),
            devDependencies: await makeDependencyMap(
                pkgConfig.devDependencies ?? [],
            ),
            peerDependencies: await makeDependencyMap(
                pkgConfig.peerDependencies ?? [],
            ),
        })
    }

    // Generate .yarnrc.yml
    const releasesDir = path.join(__dirname, '..', '..', '.yarn', 'releases')
    const yarnBinary = path.resolve(path.join(releasesDir, 'yarn-sources.cjs'))
    await fs.symlink(yarnBinary, path.join(workingDir, 'run-yarn.cjs'))
    await fs.writeFile(
        path.join(workingDir, '.yarnrc.yml'),
        `yarnPath: ./run-yarn.cjs\nenableGlobalCache: false`,
        'utf-8',
    )

    // Initialize project
    const configuration = await Configuration.find(
        npath.toPortablePath(workingDir),
        getPluginConfiguration(),
    )
    const { project } = await Project.find(
        configuration,
        npath.toPortablePath(workingDir),
    )
    await project.install({
        cache: await Cache.find(configuration),
        report: new ThrowReport(),
    })

    return workingDir
}

export async function withMonorepoContext(
    monorepo: Record<string, PackageInitConfiguration>,
    cb: (projectPath: string) => Promise<void>,
    debug = false,
): Promise<void> {
    const cwd = await setupMonorepo(monorepo)
    try {
        await cb(cwd)
    } finally {
        if (debug) {
            console.log(`Working Directory: ${cwd}`)
        } else {
            await fs.rmdir(cwd, { recursive: true })
        }
    }
}
