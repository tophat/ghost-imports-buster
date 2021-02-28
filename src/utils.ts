import { resolve } from 'path'

import { Configuration, Project } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { PortablePath } from '@yarnpkg/fslib'

import { AnalysisConfiguration, Arguments, Context } from './types'

export function getConfiguration(args: Arguments): AnalysisConfiguration {
    return {
        includes: new Set(args.includes ?? ['**/**']),
    }
}

export async function getContext(cwd?: string): Promise<Context> {
    const fullCwd = resolve(process.cwd(), cwd ?? '') as PortablePath
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, fullCwd)
    return { configuration, project, cwd: fullCwd }
}
