import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'databaseViewer.addConnection',
    () => {
      vscode.window.showInformationMessage('Database Viewer: Add Connection command activated');
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
