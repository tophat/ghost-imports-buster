import { PackageConfig } from './types.d'
import { MockFileTree } from './mockTypes.d'

export const mockPackageConfig: PackageConfig = {
    name: 'dependency-enforcer',
    version: '0.0.0',
    description:
        'Enforce the presence of all imported dependencies in your package configuration',
    main: 'lib/index.js',
    author: 'Marc Cataford <marc.cataford@tophatmonocle.com>',
    license: 'MIT',
    scripts: {
        build: 'tsc',
        test: 'jest',
        'test:watch': 'jest --watchAll',
    },
    devDependencies: {
        '@types/jest': '^24.0.23',
        '@types/node': '^12.12.7',
        jest: '^24.9.0',
        'ts-jest': '^24.1.0',
        typescript: '^3.7.2',
    },
    dependencies: {},
    peerDependencies: {},
}

export const mockFileTree: MockFileTree = {
    dir1: { isDir: true, name: 'dir1', children: ['file2', 'dir2'] },
    'dir1/file2': { isDir: false, name: 'file2', children: [] },
    'dir1/dir2': { isDir: true, name: 'dir2', children: ['file3'] },
    'dir1/dir2/file3': { isDir: false, name: 'file3', children: [] },
    file1: { isDir: false, name: 'file1', children: [] },
}

export const mockSourceWithoutImports = `
            function myFunc(a,b) {
                console.log(a+b)
            }

            myFunc(1,2)
            `

export const mockJSXSourceWithoutImports = `
            export const myComponent = <div>Test</div>
            `

export const mockSourceWithImports = `
            import { someBuiltIn } from 'fs'
            import { myFunction } from './index'
            const first = 1
            const second = 2
            
            function myFunc(a,b) {
                console.log(a+b)
            }

            myFunc(first,second)
            `

export const mockJSXSourceWithImports = `
            import React from 'react'
            import { myFunction } from './index'
            export const myComponent = <div>Test</div>
        `
