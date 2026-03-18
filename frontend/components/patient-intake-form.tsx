"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  User,
  FileText,
  Stethoscope,
  Upload,
  Mic,
  MicOff,
  X,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import type { PatientFormData } from "@/lib/types";

interface PatientIntakeFormProps {
  onSubmit: (data: PatientFormData) => void;
  isLoading: boolean;
}

export function PatientIntakeForm({
  onSubmit,
  isLoading,
}: PatientIntakeFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    patientId: "",
    medicalHistory: "",
    symptoms: "",
    imageFile: null,
    imagePreview: null,
    isRecording: false,
    audioBlob: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          imageFile: file,
          imagePreview: event.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          imageFile: file,
          imagePreview: event.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRecording = async () => {
    if (formData.isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setFormData((prev) => ({ ...prev, isRecording: false }));
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          setFormData((prev) => ({ ...prev, audioBlob }));
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setFormData((prev) => ({ ...prev, isRecording: true }));
      } catch {
        console.error("Failed to access microphone");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symptoms.trim()) return;
    onSubmit(formData);
  };

  return (
    <Card className="h-full border-border/50 shadow-lg">
      <CardHeader className="border-b border-border/50 bg-card">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          Patient Intake
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Patient Information Section */}
          <div className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <User className="h-4 w-4" />
              Patient Information
            </h3>

            <div className="flex flex-col gap-2">
              <Label htmlFor="patientId" className="text-sm font-medium">
                Patient ID
              </Label>
              <Input
                id="patientId"
                name="patientId"
                placeholder="e.g., PT-10492"
                value={formData.patientId}
                onChange={handleInputChange}
                className="bg-input/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="medicalHistory" className="text-sm font-medium">
                Medical History
              </Label>
              <Textarea
                id="medicalHistory"
                name="medicalHistory"
                placeholder="Enter existing conditions, allergies, previous surgeries..."
                value={formData.medicalHistory}
                onChange={handleInputChange}
                rows={3}
                className="resize-none bg-input/50"
              />
            </div>
          </div>

          {/* Current Consultation Section */}
          <div className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              Current Consultation
            </h3>

            <div className="flex flex-col gap-2">
              <Label htmlFor="symptoms" className="text-sm font-medium">
                Symptoms / Complaint{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="symptoms"
                name="symptoms"
                placeholder="Describe the patient's main complaint, symptoms, and relevant details..."
                value={formData.symptoms}
                onChange={handleInputChange}
                rows={4}
                required
                className="resize-none bg-input/50"
              />
            </div>

            {/* Voice Recording */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={formData.isRecording ? "destructive" : "outline"}
                size="sm"
                onClick={toggleRecording}
                className="gap-2"
              >
                {formData.isRecording ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Record Voice
                  </>
                )}
              </Button>
              {formData.audioBlob && !formData.isRecording && (
                <span className="text-sm text-success">
                  Audio recorded successfully
                </span>
              )}
              {formData.isRecording && (
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  Recording...
                </span>
              )}
            </div>
          </div>

          {/* Imaging Section */}
          <div className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              Imaging
            </h3>

            {formData.imagePreview ? (
              <div className="relative rounded-lg border border-border bg-muted/30 p-4">
                <img
                  src={formData.imagePreview}
                  alt="Uploaded X-Ray"
                  className="mx-auto max-h-48 rounded-md object-contain"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {formData.imageFile?.name}
                </p>
              </div>
            ) : (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border/70 bg-muted/20 p-8 transition-colors hover:border-primary/50 hover:bg-muted/40"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Upload X-Ray / Image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Drag and drop or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG, JPEG supported
                  </p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="mt-2 w-full gap-2"
            disabled={isLoading || !formData.symptoms.trim()}
          >
            {isLoading ? (
              <>
                <Spinner className="h-5 w-5" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Analyze Case
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
