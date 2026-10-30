# detener.ps1 - para el servidor y la pantalla completa SIN desinstalar.
# Cerrar el navegador no basta: run-kiosk.ps1 lo reabre a los 3 s. Aqui se para el que lo reabre, con todo lo que abrio.
# Vuelven a arrancar al iniciar sesion (o con iniciar.ps1). Para quitarlos del todo: uninstall.ps1.
#   powershell -ExecutionPolicy Bypass -File detener.ps1
param(
  [string]$InstallDir = $(if (Test-Path "$env:ProgramData\RadioDeacero\config.json") { "$env:ProgramData\RadioDeacero" } else { Join-Path $env:LOCALAPPDATA 'RadioDeacero' }),
  [switch]$SoloPorPID,   # sin el recurso de emergencia (lo usan install/uninstall)
  [switch]$Silencioso
)
$ErrorActionPreference = 'Continue'
function Say($m) { if (-not $Silencioso) { Write-Host "  $m" } }

# taskkill /T da "Acceso denegado" con procesos lanzados por el Programador de tareas aunque sean del mismo usuario; Stop-Process si puede.
# Por eso el arbol (el lanzador, Node, el navegador) se calcula con la lista de procesos de Windows y se para uno por uno.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ProcTree {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct PROCESSENTRY32 {
    public uint dwSize, cntUsage, th32ProcessID; public IntPtr th32DefaultHeapID; public uint th32ModuleID, cntThreads, th32ParentProcessID;
    public int pcPriClassBase; public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32First(IntPtr h, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32Next(IntPtr h, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static int[] Descendants(int root) {
    var parent = new Dictionary<int, int>();
    IntPtr snap = CreateToolhelp32Snapshot(2, 0);
    var e = new PROCESSENTRY32(); e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
    if (Process32First(snap, ref e)) { do { parent[(int)e.th32ProcessID] = (int)e.th32ParentProcessID; } while (Process32Next(snap, ref e)); }
    CloseHandle(snap);
    var found = new List<int>(); var queue = new Queue<int>(); queue.Enqueue(root);
    while (queue.Count > 0) {
      int cur = queue.Dequeue();
      foreach (var kv in parent) { if (kv.Value == cur && kv.Key != root && !found.Contains(kv.Key)) { found.Add(kv.Key); queue.Enqueue(kv.Key); } }
    }
    return found.ToArray();
  }
}
'@
function Stop-Tree([int]$root) {
  $kids = [ProcTree]::Descendants($root)            # se calculan antes de parar al lanzador (si no, se pierde el parentesco)
  Stop-Process -Id $root -Force -ErrorAction SilentlyContinue   # primero el lanzador: si no, reabriria Node o el navegador
  foreach ($k in $kids) { Stop-Process -Id $k -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300
  return -not (Get-Process -Id $root -ErrorAction SilentlyContinue)
}

# Lo normal: run-server.ps1 y run-kiosk.ps1 guardan su PID en logs\ (las versiones viejas, en la raiz); se paran con todo su arbol (Node, navegador).
# Primero la pantalla: si no, relanzaria el navegador.
$stopped = 0; $pidFiles = 0
foreach ($n in @('run-kiosk.pid', 'run-server.pid')) {
  foreach ($f in @((Join-Path $InstallDir "logs\$n"), (Join-Path $InstallDir $n))) {
    if (-not (Test-Path $f)) { continue }
    $pidFiles++
    $pidNum = 0
    if (-not [int]::TryParse((Get-Content $f -Raw).Trim(), [ref]$pidNum)) { continue }
    $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
    # Solo si el proceso ya existia cuando se escribio el archivo (descarta un PID reutilizado por otro programa).
    if ($p -and $pidNum -ne $PID -and $p.ProcessName -eq 'powershell' -and $p.StartTime -le (Get-Item $f).LastWriteTime.AddSeconds(5)) {
      if (Stop-Tree $pidNum) { Say "Parado: $n (PID $pidNum)"; $stopped++ }
      else { Say "AVISO: no se pudo parar $n (PID $pidNum): es de otro usuario o tiene permisos elevados; reinicia el PC o paralo como administrador." }
    }
  }
}

# Recurso de emergencia (instalacion antigua, sin archivos PID): sin permiso para consultar procesos no hay forma de reconocerlos por su
# linea de comandos, asi que se paran los PowerShell SIN ventana (los que lanzaron los accesos de Inicio). Las ventanas visibles no se tocan.
if ($pidFiles -eq 0 -and -not $SoloPorPID) {
  Say 'Sin archivos PID (instalacion antigua): se paran los PowerShell ocultos de este usuario.'
  Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID -and $_.MainWindowHandle -eq 0 } | ForEach-Object {
    if (Stop-Tree $_.Id) { Say "Parado: PowerShell oculto (PID $($_.Id))"; $stopped++ }
  }
}

if ($stopped -eq 0) { Say 'No habia nada corriendo que parar.' } else { Say 'Listo. Al iniciar sesion de nuevo arrancan solos (o usa Iniciar).' }
