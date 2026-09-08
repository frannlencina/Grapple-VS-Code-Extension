import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';

// Definimos la interfaz usando vscode.Uri para máxima compatibilidad
interface CheckpointType {
  id: string;
  label: string;
  fileUri: vscode.Uri;
  line: number;
  character: number;
  createdAt: number;
}

let currentCheckpoint: CheckpointType | null = null;

// Tipo de decoración a nivel global
const checkpointDecorationType = vscode.window.createTextEditorDecorationType({
  border: '2px solid rgb(84, 249, 254)',
});

// Función encargada de pintar o limpiar la marca visual
function actualizarDecoraciones() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) { return; }

  // Si no hay checkpoint, o el archivo actual no coincide con el del checkpoint, limpiamos las marcas
  if (!currentCheckpoint || currentCheckpoint.fileUri.toString() !== activeEditor.document.uri.toString()) {
    activeEditor.setDecorations(checkpointDecorationType, []);
    return;
  }

  // Si coincide el archivo, creamos el rango para la línea guardada
  const rango = new vscode.Range(currentCheckpoint.line, 0, currentCheckpoint.line, 0);

  const decoraciones: vscode.DecorationOptions[] = [{
    range: rango,
    hoverMessage: '⚓ **Checkpoint Activo aquí**'
  }];

  // Aplicamos la marca al editor activo
  activeEditor.setDecorations(checkpointDecorationType, decoraciones);
}

export function activate(context: vscode.ExtensionContext) {

  // Crear Checkpoint
  let createCheckPointCommand = vscode.commands.registerCommand("grapple.createCheckpoint", () => {
    let editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage("No hay ningún archivo abierto");
      return;
    }
    const position = editor.selection.active;
    const fileUri = editor.document.uri;
    const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'Archivo';

    currentCheckpoint = {
      id: randomUUID(),
      label: `Checkpoint en ${fileName}`,
      fileUri: fileUri,
      line: position.line,
      character: position.character,
      createdAt: Date.now()
    };

    // Refrescar la pantalla inmediatamente al crear el checkpoint
    actualizarDecoraciones();

    vscode.window.showInformationMessage(`❇️ Checkpoint guardado en ${fileName}, línea ${position.line + 1}`);
  });

  // Ir al Checkpoint
  let gotoCheckPointCommand = vscode.commands.registerCommand("grapple.gotoCheckpoint", async () => {
    if (!currentCheckpoint) {
      vscode.window.showErrorMessage('No has guardado ningún checkpoint todavía.');
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(currentCheckpoint.fileUri);
      const editor = await vscode.window.showTextDocument(document);

      const targetPosition = new vscode.Position(currentCheckpoint.line, currentCheckpoint.character);
      editor.selection = new vscode.Selection(targetPosition, targetPosition);
      editor.revealRange(new vscode.Range(targetPosition, targetPosition), vscode.TextEditorRevealType.InCenter);

      // Al cambiar de archivo mediante el comando, forzamos la actualización visual
      actualizarDecoraciones();

    } catch (error) {
      vscode.window.showErrorMessage('No se pudo regresar al checkpoint. ¿El archivo fue movido o borrado?');
    }
  });

  let deleteCheckpointCommand = vscode.commands.registerCommand("grapple.deleteCheckpoint", () => {
    if (!currentCheckpoint) {
      vscode.window.showErrorMessage('No hay ningún checkpoint activo para borrar.');
      return;
    }
    currentCheckpoint = null;
    actualizarDecoraciones();
    vscode.window.showInformationMessage('❌ **Checkpoint Eliminado**');
  })

  // Escuchar eventos del sistema para pintar/borrar marcas automáticamente

  // Al cambiar entre pestañas de archivos
  vscode.window.onDidChangeActiveTextEditor(editor => {
    actualizarDecoraciones();
  }, null, context.subscriptions);

  // Al escribir en el documento (opcional, pero ayuda a refrescar si el documento cambia)
  vscode.workspace.onDidChangeTextDocument(event => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      actualizarDecoraciones();
    }
  }, null, context.subscriptions);

  // Intentar pintar la marca si ya hay un editor abierto al arrancar la extensión
  actualizarDecoraciones();

  // 3. LIMPIEZA: Pasamos ambos comandos al array de suscripciones
  context.subscriptions.push(createCheckPointCommand, gotoCheckPointCommand, deleteCheckpointCommand);
}

export function deactivate() { }
