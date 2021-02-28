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
    .option('includes', {
        type: 'array',
        description: 'Paths to includes in the analysis',
    }).argv

validateDependencies({ cwd: argv.cwd, includes: argv.includes as string[] })
    .catch((e) => {
        console.log(e)
        process.exit(1)
    })
    .then(printReport)
