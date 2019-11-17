import * as fs from 'fs'

import { MockFileTree, MockStat } from './mockTypes.d'
import { PackageConfig } from './types.d'
import * as useCases from './useCases'

jest.mock('fs')

const mockPackageConfig: PackageConfig = {
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

const mockFileTree: MockFileTree = {
    dir1: { isDir: true, name: 'dir1', children: ['file2', 'dir2'] },
    'dir1/file2': { isDir: false, name: 'file2', children: [] },
    'dir1/dir2': { isDir: true, name: 'dir2', children: ['file3'] },
    'dir1/dir2/file3': { isDir: false, name: 'file3', children: [] },
    file1: { isDir: false, name: 'file1', children: [] },
}
const prepareFileTreeMocks = (mockTree: MockFileTree): void => {
    jest.spyOn(fs, 'lstatSync').mockImplementation(
        (path: fs.PathLike): MockStat => {
            return {
                ...fs.Stats.prototype,
                isDirectory: (): boolean => mockTree[path as string].isDir,
                isFile: (): boolean => !mockTree[path as string].isDir,
            }
        },
    )
    jest.spyOn(fs, 'readdirSync').mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (path: fs.PathLike): any => {
            return mockTree[path as string].children
        },
    )
}

describe('Package Dependency Validator', () => {
    it('extracts dependency list from package config', () => {
        const dependencies = useCases.gatherPackageConfigDependencies(
            mockPackageConfig,
        )
        const expected = {
            dependencies: [],
            devDependencies: Object.keys(mockPackageConfig.devDependencies),
            peerDependencies: [],
        }
        expect(dependencies).toEqual(expected)
    })

    describe('discoverSourceFiles', () => {
        beforeEach(() => {
            jest.restoreAllMocks()
            prepareFileTreeMocks(mockFileTree)
        })

        it('collects all files that are descendents of the given path if path is a directory', () => {
            const discovered = useCases.discoverSourceFiles(
                mockFileTree.dir1.name,
            )
            expect(discovered).toEqual(['dir1/file2', 'dir1/dir2/file3'])
        })

        it('collects only the target file if the path is a file', () => {
            const discovered = useCases.discoverSourceFiles(
                mockFileTree.file1.name,
            )
            expect(discovered).toEqual(['file1'])
        })
    })

    describe('getImportsFromFile', () => {
        it('returns an empty list if there are no dependencies', () => {
            const mockSourceWithoutImports = `
            const first = 1
            const second = 2
            
            function myFunc(a,b) {
                console.log(a+b)
            }

            myFunc(first,second)
            `

            jest.spyOn(fs, 'readFileSync').mockReturnValue(
                mockSourceWithoutImports,
            )

            const imports = useCases.getImportsFromFile('some/file/path')
            expect(imports).toHaveLength(0)
        })

        it('returns a list of imports if there are one or more imports', () => {
            const mockSourceWithImports = `
            import { someBuiltIn } from 'fs'
            import { myFunction } from './index'
            const first = 1
            const second = 2
            
            function myFunc(a,b) {
                console.log(a+b)
            }

            myFunc(first,second)
            `

            jest.spyOn(fs, 'readFileSync').mockReturnValue(
                mockSourceWithImports,
            )

            const imports = useCases.getImportsFromFile('some/file/path')
            expect(imports).toEqual(['fs', './index'])
        })
    })

    describe('getImportsFromFiles', () => {
        it('calls getImportsFromFile for each given path', () => {
            const mock = jest.spyOn(useCases, 'getImportsFromFile')

            const mockPaths = ['a', 'b', 'c', 'd']

            useCases.getImportsFromFiles(mockPaths)

            expect(mock).toHaveBeenCalledTimes(mockPaths.length)
        })
    })

    describe('getDependenciesDiff', () => {
        it('returns the difference of what is in A but not in B', () => {
            const first = ['a', 'b', 'c', 'd']
            const second = ['a', 'b', 'c']
            expect(useCases.getDependenciesDiff(first, second)).toEqual(['d'])
        })

        it('applies the option filter', () => {
            const first = ['a', 'b', 'c', 'd', 'e']
            const second = ['a', 'b', 'c']
            const filter = (value: string): boolean => value !== 'd'
            expect(
                useCases.getDependenciesDiff(first, second, filter),
            ).toEqual(['e'])
        })
    })

    describe('getUnusedDependencies', () => {
        it('calls getDependenciesDiff', () => {
            const mock = jest.spyOn(useCases, 'getDependenciesDiff')
            const mockFirst = ['a']
            const mockSecond = ['b']
            useCases.getUnusedDependencies(mockFirst, mockSecond)
            expect(mock).toHaveBeenCalledWith(mockFirst, mockSecond)
        })
    })

    describe('getUndeclaredDependencies', () => {
        it('calls getDependenciesDiff with a filter', () => {
            const mock = jest.spyOn(useCases, 'getDependenciesDiff')
            jest.spyOn(useCases, 'isBuiltIn').mockImplementation(
                (): boolean => false,
            )
            const mockFirst = ['a']
            const mockSecond = ['b']
            useCases.getUndeclaredDependencies(mockFirst, mockSecond)
            expect(mock).toHaveBeenCalledWith(
                mockSecond,
                mockFirst,
                useCases.isBuiltIn,
            )
        })
    })
})
