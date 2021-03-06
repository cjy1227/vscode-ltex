/* Copyright (C) 2020 Julian Valentin, LTeX Development Community
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as Assert from 'assert';
import * as Code from 'vscode';
import * as CodeLanguageClient from 'vscode-languageclient';

import * as Ltex from '../src/extension';

describe('Test extension (end-to-end)', () => {
  let api: Ltex.Api | null = null;
  let languageClient: CodeLanguageClient.LanguageClient | null = null;

  async function createNewFile(codeLanguage: string, contents?: string):
        Promise<Code.TextDocument> {
    return await Code.workspace.openTextDocument({language: codeLanguage, content: contents});
  }

  async function sleep(ms: number): Promise<void> {
    return new Promise((resolve: () => void) => setTimeout(resolve, ms));
  }

  before(async () => {
    const ltex: Code.Extension<Ltex.Api> | undefined =
        Code.extensions.getExtension('valentjn.vscode-ltex');
    if (ltex == null) throw new Error('Could not find LTeX.');
    await createNewFile('markdown');
    console.log('Waiting for activation of LTeX...');
    while (!ltex.isActive) await sleep(200);

    api = ltex.exports;

    if (api.clientOutputChannel == null) throw new Error('Client output channel not initialized.');
    console.log(api.clientOutputChannel.getContents());
    api.clientOutputChannel.onAppend((text: string) => {
      console.log(text);
    });

    if (api.serverOutputChannel == null) throw new Error('Server output channel not initialized.');
    console.log(api.serverOutputChannel.getContents());
    api.serverOutputChannel.onAppend((text: string) => {
      console.log(text);
    });

    console.log('Waiting for language client to be ready...');
    languageClient = api.languageClient;
    if (languageClient == null) throw new Error('Language client not initialized.');
    await languageClient.onReady();
    console.log('Language client is ready.');
  });

  async function testCheckingResult(document: Code.TextDocument): Promise<void> {
    return new Promise((resolve: () => void, reject: (e: Error) => void) => {
      if (languageClient == null) throw new Error('Language client not initialized.');
      languageClient.onNotification('textDocument/publishDiagnostics',
            (params: CodeLanguageClient.PublishDiagnosticsParams) => {
        if (params.uri == document.uri.toString()) {
          try {
            Assert.strictEqual(params.diagnostics.length, 1);
            Assert.strictEqual(params.diagnostics[0].source, 'LTeX - EN_A_VS_AN');
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      });
    });
  }

  it('test1.md - Test checking of Markdown files', async () => {
    const document: Code.TextDocument = await createNewFile('markdown',
        'This is an *test*.');
    return testCheckingResult(document);
  });

  it('test1.tex - Test checking of LaTeX files', async () => {
    const document: Code.TextDocument = await createNewFile('latex',
        'This is an \\textbf{test}.');
    return testCheckingResult(document);
  });
});
