; NSIS自定义安装脚本 - UTF-8编码
; 实现强制关闭应用和智能安装路径

!macro customInit
  ; 强制关闭运行中的应用（使用系统命令）
  nsExec::Exec 'tasklist /FI "IMAGENAME eq 怪兽派对.exe" /NH'
  Pop $R0
  
  ; 如果返回值包含进程信息，说明正在运行
  StrCmp $R0 "" notrunning
    StrCpy $R1 $R0 0 0
    ${If} $R1 != ""
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到程序正在运行\r\n\r\n点击【确定】强制关闭并继续安装\r\n点击【取消】退出安装" IDOK forceclose IDCANCEL abortinstall
      
      abortinstall:
        Abort
      
      forceclose:
        ; 强制终止进程
        nsExec::Exec 'taskkill /F /IM "怪兽派对.exe"'
        Sleep 1000
    ${EndIf}
  
  notrunning:
!macroend

!macro customInstall
  ; 智能处理安装路径
  ; 如果用户选择的是根目录，自动追加应用名称
  StrCpy $0 "$INSTDIR"
  StrLen $1 "$0"
  
  ; 获取最后一个字符
  ${If} $1 > 0
    StrCpy $2 "$0" 1 -1
    ; 如果路径以 \ 结尾（根目录）
    ${If} $2 == "\"
      StrCpy $INSTDIR "$0怪兽派对"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; 卸载时也关闭运行的应用
  nsExec::Exec 'tasklist /FI "IMAGENAME eq 怪兽派对.exe" /NH'
  Pop $R0
  
  StrCmp $R0 "" done
    StrCpy $R1 $R0 0 0
    ${If} $R1 != ""
      nsExec::Exec 'taskkill /F /IM "怪兽派对.exe"'
      Sleep 500
    ${EndIf}
  
  done:
!macroend
