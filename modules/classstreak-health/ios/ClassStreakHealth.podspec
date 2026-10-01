Pod::Spec.new do |s|
 s.name='ClassStreakHealth'
 s.version='1.0.0'
 s.summary='Read-only workout overlap for ClassStreak'
 s.description=s.summary
 s.license={:type=>'MIT'}
 s.author='ClassStreak'
 s.homepage='https://github.com/saad-shabbir/turf'
 s.source={:git=>'https://github.com/saad-shabbir/turf.git'}
 s.platforms={:ios=>'16.4'}
 s.swift_version='5.9'
 s.static_framework=true
 s.dependency 'ExpoModulesCore'
 s.frameworks='HealthKit'
 s.source_files='**/*.swift'
end
