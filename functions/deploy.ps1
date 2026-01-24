firebase functions:config:set predictor.base_url="https://cloudrun-predictor-506885133704.europe-west2.run.app" predictor.model_version="epl-v3" 
firebase deploy --only "functions"
