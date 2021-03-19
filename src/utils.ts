import { resolve } from 'path'

//import minimatch from 'minimatch'
import { Configuration, Project, structUtils } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { npath } from '@yarnpkg/fslib'

import {
    AnalysisConfiguration,
    Arguments,
    Context,
    //    FileMatchPredicate,
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
    /*
    const includeFiles: FileMatchPredicate | undefined = includeFilesFromArgs
        ? (filePath): boolean =>
              includeFilesFromArgs.some((pattern) =>
                  minimatch(filePath, pattern),
              )
        : includeFilesFromFile

    const excludeFiles: FileMatchPredicate | undefined = excludeFilesFromArgs
        ? (filePath): boolean =>
              excludeFilesFromArgs.some((pattern) =>
                  minimatch(filePath, pattern),
              )
        : excludeFilesFromFile
    */
    const excludePackages:
        | PackageMatchPredicate
        | undefined = excludePackagesFromArgs
        ? (packageName): boolean =>
              excludePackagesFromArgs.includes(packageName)
        : excludePackagesFromFile

    /*
    const devFiles: FileMatchPredicate | undefined = devFilesFromArgs
        ? (filePath): boolean =>
              devFilesFromArgs.some((pattern) => minimatch(filePath, pattern))
        : devFilesFromFile
    */

    return {
        includeFiles, //: includeFiles ?? ((): boolean => true),
        excludeFiles, //: excludeFiles ?? ((): boolean => false),
        excludePackages: excludePackages ?? ((): boolean => false),
        devFiles, //: devFiles ?? ((): boolean => false),
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
        /*
        const includeFilesFromConfig =
            typeof includeFiles === 'function'
                ? includeFiles
                : (filename: string): boolean =>
                      includeFiles?.some?.((pattern: string) =>
                          minimatch(filename, pattern),
                      ) ?? true

        const excludeFilesFromConfig =
            typeof excludeFiles === 'function'
                ? excludeFiles
                : (filename: string): boolean =>
                      excludeFiles?.some?.((pattern: string) =>
                          minimatch(filename, pattern),
                      ) ?? false
                     */

        //const defaultDevFiles = (filename: string): boolean =>
        //   ['**/__tests__/**', '**/tests/**', '**/*.test.*'].some((pattern) =>
        //      minimatch(filename, pattern),
        //  )

        //const devFilesFromConfig =
        //   typeof devFiles === 'function'
        //        ? devFiles
        //       : (filename: string): boolean =>
        //             devFiles?.some?.((pattern: string) =>
        //                 minimatch(filename, pattern),
        //             ) ?? defaultDevFiles(filename)

        const excludePackagesFromConfig =
            typeof excludePackages === 'function'
                ? excludePackages
                : (filename: string): boolean =>
                      excludePackages?.includes?.(filename) ?? false

        return {
            includeFiles, //: includeFilesFromConfig,
            excludeFiles, //: excludeFilesFromConfig,
            excludePackages: excludePackagesFromConfig,
            devFiles, //: devFilesFromConfig,
        }
    } catch (e) {
        /* Configuration unavailable */
        return {}
    }
}
