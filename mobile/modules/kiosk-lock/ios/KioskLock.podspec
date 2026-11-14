Pod::Spec.new do |s|
  s.name           = 'KioskLock'
  s.version        = '1.0.0'
  s.summary        = 'Locks the device to the app for till kiosks (Guided Access).'
  s.author         = 'tazdan'
  s.homepage       = 'https://tazdan.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
