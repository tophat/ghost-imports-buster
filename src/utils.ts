import { resolve } from 'path'

import minimatch from 'minimatch'
import { Configuration, Project } from '@yarnpkg/core'
import { getPluginConfiguration } from '@yarnpkg/cli'
import { PortablePath, npath } from '@yarnpkg/fslib'

import {
    AnalysisConfiguration,
    Arguments,
    Context,
    FileMatchPredicate,
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

    const includeFilesFromArgs = args.includeFiles
    const excludeFilesFromArgs = args.excludeFiles
    const excludePackagesFromArgs = args.excludePackages

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
    const excludePackages:
        | PackageMatchPredicate
        | undefined = excludePackagesFromArgs
        ? (packageName): boolean =>
              excludePackagesFromArgs.includes(packageName)
        : excludePackagesFromFile
    return {
        includeFiles: includeFiles ?? ((): boolean => true),
        excludeFiles: excludeFiles ?? ((): boolean => false),
        excludePackages: excludePackages ?? ((): boolean => false),
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
        const configurationFilePath = require.resolve(
            npath.toPortablePath('./ghost-imports.config.js'),
            {
                paths: [cwd],
            },
        )
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const configuration = require(configurationFilePath) || {}

        const { includeFiles, excludeFiles, excludePackages } = configuration
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
                      ) ?? true

        const excludePackagesFromConfig =
            typeof excludePackages === 'function'
                ? excludePackages
                : (filename: string): boolean =>
                      excludePackages?.includes?.(filename) ?? false

        return {
            includeFiles: includeFilesFromConfig,
            excludeFiles: excludeFilesFromConfig,
            excludePackages: excludePackagesFromConfig,
        }
    } catch (e) {
        /* Configuration unavailable */
        return {}
    }
}
