/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import { npath } from '@yarnpkg/fslib'
import { Cache, Configuration, Project, ThrowReport } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'

// FIXME: better typing?
interface ProjectOverrides {
    [key: string]: any
}

type Callback = (...args: unknown[]) => Promise<unknown>

export async function withDirectoryContext(
    projectOverrides: ProjectOverrides,
    callback: Callback,
): Promise<void> {
    let tempRoot
    let error
    try {
        const rootPath = await fs.mkdtemp(`${tmpdir()}/`)
        tempRoot = rootPath

        const isMonorepo = projectOverrides.root !== undefined
        for (const [projectName, projectOverride] of Object.entries(
            projectOverrides,
        )) {
            const isMonorepoRoot = projectName === 'root'
            const packageManifest = {
                ...projectOverride,
                name: projectName,
                dependencies: projectOverride?.dependencies ?? {},
                devDependencies: projectOverride?.devDependencies ?? {},
                peerDependencies: projectOverride?.peerDependencies ?? {},
            }

            if (isMonorepo && isMonorepoRoot) {
                packageManifest.workspaces = packageManifest.workspaces || [
                    'packages/*',
                ]
            }

            const projectPath =
                isMonorepo && !isMonorepoRoot
                    ? `${tempRoot}/root/packages/${projectName}/`
                    : `${tempRoot}/${projectName}/`
            await createFile(
                projectPath,
                'package.json',
                JSON.stringify(packageManifest, null, 2),
            )

            if ((isMonorepo && isMonorepoRoot) || !isMonorepo) {
                const releasesDir = path.join(
                    __dirname,
                    '..',
                    '.yarn',
                    'releases',
                )
                const yarnBinary = path.resolve(
                    path.join(releasesDir, 'yarn-sources.cjs'),
                )
                await fs.symlink(
                    yarnBinary,
                    path.join(projectPath, 'run-yarn.cjs'),
                )
                await fs.writeFile(
                    path.join(projectPath, '.yarnrc.yml'),
                    `yarnPath: ./run-yarn.cjs\nenableGlobalCache: false`,
                    'utf-8',
                )
                await fs.writeFile(
                    path.join(projectPath, 'yarn.lock'),
                    ``,
                    'utf-8',
                )
                const configuration = await Configuration.find(
                    npath.toPortablePath(projectPath),
                    getPluginConfiguration(),
                )
                const { project } = await Project.find(
                    configuration,
                    npath.toPortablePath(projectPath),
                )
                await project.install({
                    cache: await Cache.find(configuration),
                    report: new ThrowReport(),
                })
            }
        }

        await callback(rootPath)
    } catch (e) {
        error = e
    } finally {
        if (tempRoot) await cleanUp([tempRoot])
    }
    if (error) throw error
}

export async function cleanUp(paths: string[]): Promise<void> {
    await Promise.all(
        paths.map(async (tempPath) => fs.rmdir(tempPath, { recursive: true })),
    )
}

export async function readFile(filename: string): Promise<string> {
    return fs.readFile(filename, { encoding: 'utf8' })
}

export async function createFile(
    cwd: string,
    filename: string,
    data: string,
): Promise<string> {
    const filePath = path.resolve(cwd, filename)
    const parentDirectory = path.dirname(filePath)
    await fs.mkdir(parentDirectory, { recursive: true })
    await fs.writeFile(filePath, data, { encoding: 'utf8' })

    return filePath
}
