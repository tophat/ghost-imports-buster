import { resolve } from 'path'

import { Configuration, Project, structUtils } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { npath } from '@yarnpkg/fslib'

import {
    AnalysisConfiguration,
    Arguments,
    Context,
    PackageMatchPredicate,
} from './types'

export async function getConfiguration(
    args: Arguments,
): Promise<AnalysisConfiguration> {
    const configurationFromFile = await maybeGetConfigurationFromFile(
        getFullCwd(args.cwd),
    )

    // TODO: Add support for workspace-level ex
    const includeFilesFromFile = configurationFromFile.includeFiles
    const excludeFilesFromFile = configurationFromFile.excludeFiles
    const excludePackagesFromFile = configurationFromFile.excludePackages
    const devFilesFromFile = configurationFromFile.devFiles

    const includeFilesFromArgs = args.includeFiles
    const excludeFilesFromArgs = args.excludeFiles
    const excludePackagesFromArgs = args.excludePackages
    const devFilesFromArgs = args.devFiles

    const includeFiles = (includeFilesFromArgs || includeFilesFromFile) ?? [
        '**/*',
    ]
    const excludeFiles = (excludeFilesFromArgs || excludeFilesFromFile) ?? []
    const devFiles = (devFilesFromArgs || devFilesFromFile) ?? [
        '**/__tests__/**',
        '**/tests/**',
        '**/*.test.*',
    ]
    const excludePackages:
        | PackageMatchPredicate
        | undefined = excludePackagesFromArgs
        ? (packageName): boolean =>
              excludePackagesFromArgs.includes(packageName)
        : excludePackagesFromFile

    return {
        includeFiles,
        excludeFiles,
        excludePackages: excludePackages ?? ((): boolean => false),
        devFiles,
        fix: args.fix ?? false,
        skipRoot: args.skipRoot ?? false,
    }
}

export async function getContext(
    analysisConfig: AnalysisConfiguration,
    cwd?: string,
): Promise<Context> {
    const fullCwd = npath.toPortablePath(getFullCwd(cwd))
    const configuration = await Configuration.find(
        fullCwd,
        getPluginConfiguration(),
    )
    const { project, workspace } = await Project.find(configuration, fullCwd)
    if (!workspace) throw new Error('Could not find workspace.')

    const isTopLevelWorkspace = structUtils.areDescriptorsEqual(
        workspace.anchoredDescriptor,
        workspace.project.topLevelWorkspace.anchoredDescriptor,
    )
    const workspaceCwds = new Set(
        isTopLevelWorkspace
            ? project.workspaces
                  .filter((w) =>
                      analysisConfig.skipRoot
                          ? !structUtils.areDescriptorsEqual(
                                w.anchoredDescriptor,
                                w.project.topLevelWorkspace.anchoredDescriptor,
                            )
                          : w,
                  )
                  .map((w) => w.cwd)
            : [workspace.cwd],
    )

    return { configuration, project, cwd: workspace.cwd, workspaceCwds }
}

function getFullCwd(cwd?: string): string {
    return resolve(process.cwd(), cwd ?? '')
}

async function maybeGetConfigurationFromFile(
    cwd: string,
): Promise<Partial<AnalysisConfiguration>> {
    try {
        const configurationFilePath = require.resolve(
            npath.toPortablePath('./ghost-imports.config.js'),
            {
                paths: [cwd],
            },
        )
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const configuration = require(configurationFilePath) || {}
        const {
            includeFiles,
            excludeFiles,
            excludePackages,
            devFiles,
        } = configuration

        const excludePackagesFromConfig =
            typeof excludePackages === 'function'
                ? excludePackages
                : (filename: string): boolean =>
                      excludePackages?.includes?.(filename) ?? false

        return {
            includeFiles,
            excludeFiles,
            excludePackages: excludePackagesFromConfig,
            devFiles,
        }
    } catch (e) {
        /* Configuration unavailable */
        return {}
    }
}
