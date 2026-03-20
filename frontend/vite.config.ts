import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const mockApiPlugin = () => ({
  name: 'mock-api',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/mock/analyze' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          const data = JSON.parse(body || '{}');
          const hasImage = !!data.hasImage;
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            diagnosis: {
              condition: hasImage ? "Suspected Distal Radius Fracture" : "Acute Lower Back Pain with Radiculopathy",
              confidence: hasImage ? 82 : 76,
              requiresHumanReview: true,
              soapNote: {
                subjective: "Patient presented with symptoms.",
                objective: "Vital signs within normal limits. " + (hasImage ? "Imaging studied." : "No imaging."),
                assessment: hasImage ? "Possible fracture." : "Lumbar radiculopathy.",
                plan: "1. Follow-up workup.\n2. Management."
              },
              xrayFindings: hasImage ? [{ condition: "Fracture Line", probability: 0.82, suggestion: "Possible fracture" }] : undefined
            },
            prescriptions: [
              { medication: "Ibuprofen", dosage: "400mg", frequency: "Three times daily", duration: "7 days", instructions: "Take with food." }
            ],
            referrals: [
              { specialistType: hasImage ? "Orthopedic Surgery" : "Physical Medicine", reason: "Evaluation", urgency: "urgent" }
            ]
          }));
        });
      } else if (req.url === '/mock/chat' && req.method === 'POST') {
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply: "I understand your concern. Based on the symptoms you've described, this could be related to several conditions. Please consult a physician." }));
        }, 1000);
      } else if (req.url === '/mock/transcribe' && req.method === 'POST') {
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text: "Patient reports sharp pain in the lower back radiating to the left leg, worsening with movement." }));
        }, 1500);
      } else {
        next();
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mockApiPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
