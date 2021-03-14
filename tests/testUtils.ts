/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'fs'
import path from 'path'

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
