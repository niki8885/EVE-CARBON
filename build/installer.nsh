!macro customInstall
  SetDetailsPrint both

  ; Check if a previous version is already installed
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\eve-carbon" "DisplayVersion"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "EVE-Carbon $0 is already installed.$\r$\n$\r$\nClick YES to perform a FRESH INSTALL (wipes all characters, Jabber settings, and cached data - cannot be undone).$\r$\n$\r$\nClick NO to UPGRADE (keeps all your characters and settings)." \
      /SD IDNO IDYES DoFreshInstall IDNO DoUpgrade

    DoFreshInstall:
      DetailPrint "Fresh install selected - wiping user data..."
      Delete "$APPDATA\eve-carbon\character_information.db"
      Delete "$APPDATA\eve-carbon\blueprints.json"
      Delete "$APPDATA\eve-carbon\config.json"
      RMDir /r "$APPDATA\eve-carbon\cache"
      DetailPrint "User data wiped. Proceeding with fresh install."
      Goto InstallDone

    DoUpgrade:
      DetailPrint "Upgrade selected - keeping existing characters and settings."
      Goto InstallDone

    InstallDone:
  ${Else}
    DetailPrint "No previous install detected. Performing clean install."
  ${EndIf}
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to completely wipe all saved characters, databases, and user settings?$\r$\n$\r$\nThis cannot be undone." \
    /SD IDNO IDYES WipeData IDNO KeepData

  WipeData:
    RMDir /r "$APPDATA\eve-carbon"
    Goto KeepData

  KeepData:
!macroend
