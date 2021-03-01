#!/usr/bin/env node

import yargs from 'yargs'

import printReport from './printReport'

import validateDependencies from '.'

const argv = yargs(process.argv.slice(2))
    .usage('ghostimports [projectRootPath]')
    .option('cwd', {
        type: 'string',
        description: 'Project root',
    })
    .option('include', {
        type: 'array',
        description: 'Paths to include in the analysis',
    })
    .option('exclude', {
        type: 'array',
        description: 'Paths to exclude from the analysis',
    }).argv

validateDependencies({
    cwd: argv.cwd,
    include: argv.include as string[],
    exclude: argv.exclude as string[],
})
    .catch((e) => {
        console.log(e)
        process.exit(1)
    })
    .then(printReport)
