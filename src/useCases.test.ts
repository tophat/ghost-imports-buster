import * as fs from 'fs'

import { MockFileTree, MockStat } from './mockTypes.d'
import {
    mockFileTree,
    mockJSXSourceWithImports,
    mockJSXSourceWithoutImports,
    mockPackageConfig,
    mockSourceWithImports,
    mockSourceWithoutImports,
} from './mocks'
import * as useCases from './useCases'

jest.mock('fs')

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
        it.each`
            case                     | mock
            ${'JS without imports'}  | ${mockSourceWithoutImports}
            ${'JSX without imports'} | ${mockJSXSourceWithoutImports}
        `(
            'returns an empty list if there are no dependencies for $case',
            ({ mock }) => {
                jest.spyOn(fs, 'readFileSync').mockReturnValue(mock)

                const imports = useCases.getImportsFromFile('some/file/path')
                expect(imports).toHaveLength(0)
            },
        )

        it.each`
            case                  | mock                        | expected
            ${'JS with imports'}  | ${mockSourceWithImports}    | ${['fs', './index']}
            ${'JSX with imports'} | ${mockJSXSourceWithImports} | ${['react', './index']}
        `(
            'returns a list of imports if there are one or more imports for $case',
            ({ mock, expected }) => {
                jest.spyOn(fs, 'readFileSync').mockReturnValue(mock)

                const imports = useCases.getImportsFromFile('some/file/path')
                expect(imports).toEqual(expected)
            },
        )
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
