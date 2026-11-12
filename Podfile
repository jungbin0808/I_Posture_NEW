platform :ios, '14.0'

target 'witchbox-ios' do
  use_frameworks!
  # Networking
  pod 'Alamofire'

  # Services
  pod 'GoogleSignIn'
  pod 'Firebase/Crashlytics'
  pod 'FirebaseAnalytics'
  pod 'Firebase/Messaging'
  pod 'FirebaseAuth'
  
  pod 'KakaoSDKAuth', '2.13.1'
  pod 'KakaoSDKUser', '2.13.1'
  
  pod 'naveridlogin-sdk-ios'

  #Utils
  pod 'IQKeyboardManagerSwift'
  pod 'SkeletonView'
  pod 'SDWebImage'
  pod 'MJRefresh'
  pod 'lottie-ios'
  pod 'SnapKit'
  pod 'SwiftyStoreKit'
  pod "BSImagePicker", "~> 3.1"
  pod 'DGCharts'
  pod 'PhoneNumberKit', :git => 'https://github.com/marmelroy/PhoneNumberKit'
  pod 'FBSDKCoreKit'

  #ML KIT Google
  pod 'GoogleMLKit/PoseDetection'
  pod 'GoogleMLKit/PoseDetectionAccurate'

end

post_install do |installer|
  installer.generated_projects.each do |project|
        project.targets.each do |target|
            target.build_configurations.each do |config|
                config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
                config.build_settings['ONLY_ACTIVE_ARCH'] = 'NO'
             end
        end
  end
  installer.pods_project.build_configurations.each do |config|
      config.build_settings["EXCLUDED_ARCHS[sdk=iphonesimulator*]"] = "arm64"
  end
  installer.pods_project.targets.each do |target|
    shell_script_path = "Pods/Target Support Files/#{target.name}/#{target.name}-frameworks.sh"
    if File.exist?(shell_script_path)
      shell_script_input_lines = File.readlines(shell_script_path)
      shell_script_output_lines = shell_script_input_lines.map { |line| line.sub("source=\"$(readlink \"${source}\")\"", "source=\"$(readlink -f \"${source}\")\"") }
      File.open(shell_script_path, 'w') do |f|
        shell_script_output_lines.each do |line|
          f.write line
        end
      end
    end
  end
end
