/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `translate` command */
  export type Translate = ExtensionPreferences & {}
  /** Preferences accessible in the `correct` command */
  export type Correct = ExtensionPreferences & {}
  /** Preferences accessible in the `explain` command */
  export type Explain = ExtensionPreferences & {}
  /** Preferences accessible in the `confirm` command */
  export type Confirm = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `translate` command */
  export type Translate = {}
  /** Arguments passed to the `correct` command */
  export type Correct = {}
  /** Arguments passed to the `explain` command */
  export type Explain = {}
  /** Arguments passed to the `confirm` command */
  export type Confirm = {}
}

