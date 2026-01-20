$PROJECT_ID = "footballboostmachine"
$REGION = "europe-west2"
$REPO = "containers"
$SERVICE = "cloudrun-predictor"

$TAG = (Get-Date -Format "yyyyMMdd-HHmmss")
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE`:$TAG"

cd C:\Dev\FootballBoostMachine\cloudrun-predictor

# Build and push image from this folder (where the Dockerfile is)
gcloud builds submit --tag $IMAGE .

# Deploy
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "BTTS_THRESHOLD=0.534,OVER25_THRESHOLD=0.535"

# Show URL
gcloud run services describe $SERVICE --region $REGION --format="value(status.url)"
