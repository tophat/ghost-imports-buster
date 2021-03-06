import { resolve } from 'path'
import { promises as fs } from 'fs'

import { Configuration, Project } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { PortablePath } from '@yarnpkg/fslib'

import { AnalysisConfiguration, Arguments, Context } from './types'

export async function getConfiguration(
    args: Arguments,
): Promise<AnalysisConfiguration> {
    const configurationFromFile = await maybeGetConfigurationFromFile(
        getFullCwd(args.cwd),
    )

    const includesFromFile = configurationFromFile.include ?? []
    const includesFromArgs = args.include ?? []
    const mergedIncludes = [...includesFromFile, ...includesFromArgs]

    const excludesFromFile = configurationFromFile.exclude ?? []
    const excludesFromArgs = args.exclude ?? []

    return {
        include: new Set(mergedIncludes.length ? mergedIncludes : ['**/**']),
        exclude: new Set([...excludesFromFile, ...excludesFromArgs]),
        fix: args.fix ?? false,
    }
}

export async function getContext(cwd?: string): Promise<Context> {
    const fullCwd = getFullCwd(cwd) as PortablePath
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, fullCwd)
    return { configuration, project, cwd: fullCwd }
}

function getFullCwd(cwd?: string): string {
    return resolve(process.cwd(), cwd ?? '')
}

async function maybeGetConfigurationFromFile(
    cwd: string,
): Promise<Partial<AnalysisConfiguration>> {
    try {
        const configurationFromFile = await fs.readFile(
            resolve(cwd, '.ghostImports.json'),
            { encoding: 'utf8' },
        )
        const parsedConfiguration = JSON.parse(configurationFromFile)
        return parsedConfiguration
    } catch (e) {
        /* Configuration unavailable */
        return {}
    }
}
