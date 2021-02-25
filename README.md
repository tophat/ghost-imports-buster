# Ghost Imports Buster
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->
[![codecov](https://codecov.io/gh/tophat/ghost-imports-buster/branch/master/graph/badge.svg)](https://codecov.io/gh/tophat/ghost-imports-buster)
![Build](https://github.com/tophat/ghost-imports-buster/workflows/Node.js%20CI/badge.svg?branch=master)

###### :ghost: I ain't afraid of no ghost

---

## Motivation

Because of [how NodeJS import resolution functions](https://nodejs.org/api/modules.html#modules_all_together), it is possible for packages that are not part of your project's `package.json` to the resolved by `import` and `require` statements in your code. This obviously isn't ideal because these "ghost dependencies" operate outside of the contract between your project's dependencies and whatever system installs and runs it.

Having these ghostly imports can cause a whole lot of issues, ranging from cases of "it works on my machine!" to static analysis tools failing to detect circular imports between groups of packages (if your project is a monorepo). Of course, best practices dictate that anything imported that isn't a core package should be listed in `package.json`, but sometimes best practices are overlooked and messes happen. This is where `ghost-imports-buster` comes in.

`ghost-imports-buster` compiles a list of your peer, development and production dependencies (based on `package.json`) and then traverses your package's source code to get an equivalent list of anything that is imported. It then diffs those two lists (with some exclusions, because relative/absolute file imports and core packages don't need policing) to verify that any third-party library that is used in your application code is accounted for in the package configuration.

## Installation

```
yarn add ghost-imports-buster -D
```

or

```
npm add ghost-imports-buster --save-dev
```

## Usage

```
yarn ghost-imports-buster validate <project root>
```

Note that the project root should coincide with the location of your project's `package.json` file.

## Contributing


## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://mcataford.github.io"><img src="https://avatars2.githubusercontent.com/u/6210361?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Marc Cataford</b></sub></a><br /><a href="#ideas-mcataford" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Code">💻</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Tests">⚠️</a> <a href="https://github.com/tophat/ghost-imports-buster/commits?author=mcataford" title="Documentation">📖</a> <a href="#infra-mcataford" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://opensource.tophat.com"><img src="https://avatars.githubusercontent.com/u/6020693?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Shouvik DCosta</b></sub></a><br /><a href="#infra-sdcosta" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
