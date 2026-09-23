Pod::Spec.new do |s|
  s.name           = 'DescansoVivo'
  s.version        = '1.0.0'
  s.summary        = 'La cuenta del descanso en la pantalla bloqueada (ActivityKit)'
  s.description    = 'El puente a ActivityKit para encender, mover y apagar la Live Activity del descanso. Ver modules/descanso-vivo/ios/DescansoVivoModule.swift.'
  s.author         = 'Ascent'
  s.homepage       = 'https://github.com/condezuzu/ascent'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # ActivityKit SE LINKEA DÉBIL (`-weak_framework`) y no fuerte. El piso de la
  # app es iOS 15.1 y ActivityKit apareció en la 16.1: linkeado fuerte, un
  # teléfono con iOS 15 no podría ni ABRIR la app — fallaría al cargar el
  # binario, antes de llegar a ninguna pantalla. Débil, el símbolo queda nulo y
  # los `#available` del módulo hacen el resto.
  s.weak_frameworks = 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
