$PROJECT_ID = "footballboostmachine"
$REGION = "europe-west2"
$REPO = "containers"
$SERVICE = "cloudrun-predictor"

# tag with timestamp
$TAG = (Get-Date -Format "yyyyMMdd-HHmmss")
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE`:$TAG"

# Build remotely and push
gcloud builds submit --tag $IMAGE .

# Deploy to Cloud Run
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "BTTS_THRESHOLD=0.62,OVER25_THRESHOLD=0.55"

# Print service URL
gcloud run services describe $SERVICE --region $REGION --format="value(status.url)"
