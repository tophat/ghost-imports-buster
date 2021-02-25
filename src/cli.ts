#!/usr/bin/env node

import program from 'commander'

import validateDependencies from '.'

const parseCliArgs = (args: string[]): string[] => {
    let pathsToProcess: string[] = []

    program
        .command('validate <target> [otherTargets...]')
        .option('-e', '--throwOnFail', 'Throws an error on failure.')
        .action((target: string, otherTargets: string[]) => {
            pathsToProcess = otherTargets ? [target, ...otherTargets] : [target]
        })

    program.parse(args)

    return pathsToProcess
}

//const cliArgs = process.argv
//const runParams = parseCliArgs()
validateDependencies({ cwd: process.argv[2] })
