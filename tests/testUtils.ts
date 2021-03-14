/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'

// FIXME: better typing?
interface ProjectOverrides {
    [key: string]: any
}

type Callback = (...args: unknown[]) => unknown

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

            const projectPath =
                isMonorepo && !isMonorepoRoot
                    ? `${tempRoot}/root/packages/${projectName}/`
                    : `${tempRoot}/${projectName}/`
            await createFile(
                projectPath,
                'package.json',
                JSON.stringify(packageManifest),
            )
            await createFile(projectPath, 'yarn.lock', '')
            console.log(projectPath)
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

export async function readFile(path: string): Promise<string> {
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
