!macro customInstall
  ; 检查 VC++ 运行库是否已安装（通过注册表）
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 == ""
    ; 如果未安装，则静默安装
    ExecWait '"$EXEDIR\resources\vc_redist.x64.exe" /quiet /norestart'
  ${EndIf}
!macroend