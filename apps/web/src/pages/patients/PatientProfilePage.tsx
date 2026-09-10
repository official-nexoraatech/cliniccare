import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Droplets,
  FileText,
  Layers,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Printer,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import type {
  DocumentCategory,
  PatientCustomFieldValues,
  PatientHistoryVisit,
} from "@clinic-care/shared-types";
import { usePatientMutations, usePatientQuery, usePatientSearchQuery } from "@/hooks/usePatients";
import { usePatientFieldsQuery } from "@/hooks/usePatientFields";
import { usePatientHistoryQuery } from "@/hooks/usePatientHistory";
import { useVisitMutations } from "@/hooks/useVisits";
import { useDocumentMutations } from "@/hooks/useDocuments";
import { usePatientComplianceQuery } from "@/hooks/useCompliance";
import { usePatientFollowUpsQuery } from "@/hooks/useFollowUps";
import { usePatientAppointmentsQuery } from "@/hooks/useAppointments";
import { useBillsByPatientQuery } from "@/hooks/useBilling";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { FactTile } from "@/components/FactTile";
import { VisitSummaryModal } from "@/components/VisitSummaryModal";
import { FormSkeleton } from "@/components/Skeleton";
import { resolveServerUrl } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  calculateAge,
  PatientCustomFields,
  PatientFormFields,
  patientSchema,
  validateCustomFields,
  type PatientFormValues,
} from "./patientFormShared";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNSPECIFIED: "Not specified",
};

const TABS = [
  "Profile",
  "All",
  "Prescriptions",
  "Reports & Documents",
] as const;
type Tab = (typeof TABS)[number];

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  LAB_REPORT: "Lab Report",
  XRAY: "X-Ray",
  PRESCRIPTION_SCAN: "Prescription Scan",
  DISCHARGE_SUMMARY: "Discharge Summary",
  ID_PROOF: "ID Proof",
  OTHER: "Other",
};

function ActionButton({
  children,
  onClick,
  tone = "neutral",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "neutral" | "danger" | "success";
  disabled?: boolean;
}) {
  const toneClass = {
    primary:
      "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm shadow-[#1f3864]/10 hover:bg-[#172f55]",
    neutral:
      "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    danger:
      "border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
    success:
      "border-green-200 bg-green-50 text-green-700 hover:border-green-300 hover:bg-green-100",
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
        toneClass,
      )}
    >
      {children}
    </button>
  );
}

function VisitCard({
  visit,
  onView,
  onReprint,
}: {
  visit: PatientHistoryVisit;
  onView: () => void;
  onReprint: () => void;
}) {
  const vitalsLine = visit.vital
    ? [
        visit.vital.bp && `BP ${visit.vital.bp}`,
        visit.vital.pulse && `Pulse ${visit.vital.pulse}`,
        visit.vital.weight && `Weight ${visit.vital.weight}kg`,
        visit.vital.temperature && `Temp ${visit.vital.temperature}°C`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-navy)]">
            {new Date(visit.visitDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-gray-400">{visit.visitNo}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            View Full Visit
          </button>
          {visit.prescription && (
            <button
              onClick={onReprint}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5" /> Reprint
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1.5 text-sm">
        {visit.diagnosis && (
          <p>
            <span className="font-medium text-gray-700">Diagnosis:</span>{" "}
            {visit.diagnosis}
          </p>
        )}
        {!visit.diagnosis && visit.complaint && (
          <p>
            <span className="font-medium text-gray-700">Complaint:</span>{" "}
            {visit.complaint}
          </p>
        )}
        {vitalsLine && <p className="text-xs text-gray-500">{vitalsLine}</p>}
        {visit.prescription && (
          <p className="text-xs text-gray-500">
            <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
            {visit.prescription.itemCount} medicine
            {visit.prescription.itemCount === 1 ? "" : "s"} prescribed
          </p>
        )}
        {visit.labTests.length > 0 && (
          <p className="text-xs text-gray-500">
            Tests:{" "}
            {visit.labTests
              .map(
                (t) => `${t.testName}${t.status === "DONE" ? " (done)" : ""}`,
              )
              .join(", ")}
          </p>
        )}
        {visit.advice && (
          <p className="text-xs text-gray-500">Advice: {visit.advice}</p>
        )}
      </div>
    </div>
  );
}

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: patient, isLoading } = usePatientQuery(id);
  const { data: allFieldDefs } = usePatientFieldsQuery();
  const coreFieldDefs = allFieldDefs?.filter((f) => f.isCore);
  const customFieldDefs = allFieldDefs?.filter((f) => !f.isCore);
  const { data: history } = usePatientHistoryQuery(id);
  const { data: compliance } = usePatientComplianceQuery(id);
  const { data: followUps } = usePatientFollowUpsQuery(id);
  const { data: appointments } = usePatientAppointmentsQuery(id);
  const { data: bills } = useBillsByPatientQuery(id);
  const { data: familySearchResults = [] } = usePatientSearchQuery(patient?.mobile ?? "");
  const familyMembers = familySearchResults.filter(
    (p) => p.mobile === patient?.mobile && p.id !== patient?.id,
  );
  const { deactivate, reactivate, update } = usePatientMutations();
  const { create: createVisit, start: startVisit } = useVisitMutations();
  const { upload, remove } = useDocumentMutations();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewVisit, setViewVisit] = useState<PatientHistoryVisit | null>(null);
  const [tab, setTab] = useState<Tab>("Profile");
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [customFieldValues, setCustomFieldValues] =
    useState<PatientCustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<
    Record<string, string>
  >({});
  const documentInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({ resolver: zodResolver(patientSchema) });

  useEffect(() => {
    if (patient) {
      reset({
        name: patient.name,
        age: patient.age,
        dob: patient.dob ? patient.dob.slice(0, 10) : "",
        gender: patient.gender,
        mobile: patient.mobile,
        altMobile: patient.altMobile ?? "",
        email: patient.email ?? "",
        address: patient.address ?? "",
        city: patient.city ?? "",
        pincode: patient.pincode ?? "",
        bloodGroup:
          (patient.bloodGroup as PatientFormValues["bloodGroup"]) ?? "",
        maritalStatus:
          (patient.maritalStatus as PatientFormValues["maritalStatus"]) ?? "",
        occupation: patient.occupation ?? "",
        allergies: patient.allergies ?? "",
        chronicDiseases: patient.chronicDiseases ?? "",
        stage: patient.stage ?? "",
        referredBy: patient.referredBy ?? "",
        notes: patient.notes ?? "",
      });
      setCustomFieldValues(patient.customFields ?? {});
    }
  }, [patient, reset]);

  const dob = watch("dob");
  useEffect(() => {
    if (isEditing && dob) {
      setValue("age", calculateAge(dob), { shouldValidate: true });
    }
  }, [dob, isEditing, setValue]);

  const upcomingAppointments = appointments
    ?.filter(
      (a) =>
        new Date(a.appointmentDate) >= new Date(new Date().toDateString()) &&
        ["BOOKED", "CONFIRMED"].includes(a.status),
    )
    .slice(0, 3);

  const filteredVisits = useMemo(() => {
    if (!history) return [];
    if (tab === "Prescriptions")
      return history.visits.filter((v) => v.prescription);
    return history.visits;
  }, [history, tab]);
  const reportVisits = useMemo(() => {
    if (!history) return [];
    return history.visits.filter((v) => v.labTests.length > 0);
  }, [history]);

  if (isLoading) {
    return <FormSkeleton sections={2} />;
  }

  if (!patient) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">
          Patient not found
        </h1>
        <button
          onClick={() => navigate("/patients")}
          className="mt-3 text-sm text-[var(--color-primary)]"
        >
          Back to patient list
        </button>
      </div>
    );
  }

  const hasAlerts = Boolean(patient.allergies || patient.chronicDiseases);
  const latestCompliance = compliance?.records[0];
  const nextFollowUpDate = patient.nextFollowUp?.dueDate
    ? new Date(patient.nextFollowUp.dueDate)
    : null;
  const nextFollowUpLabel = nextFollowUpDate
    ? nextFollowUpDate.toLocaleDateString("en-IN")
    : "None due";
  const nextFollowUpOverdue = Boolean(
    nextFollowUpDate && nextFollowUpDate < new Date(),
  );
  const latestVisit = history?.visits[0];
  const showStage = Boolean(patient.stage && patient.stage.trim().toLowerCase() !== "new");

  const onNewVisit = async () => {
    try {
      const visit = await createVisit.mutateAsync({ patientId: patient.id });
      await startVisit.mutateAsync(visit.id);
      navigate(`/visits/${visit.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start a new visit."));
    }
  };

  const onToggleActive = async () => {
    try {
      if (patient.isActive) {
        await deactivate.mutateAsync(patient.id);
        toast.success("Patient deactivated");
      } else {
        await reactivate.mutateAsync(patient.id);
        toast.success("Patient reactivated");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update patient status."));
    } finally {
      setConfirmOpen(false);
    }
  };

  const startEditing = () => {
    setTab("Profile");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    if (searchParams.get("edit")) {
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const onSaveProfile = async (values: PatientFormValues) => {
    const fieldErrors = validateCustomFields(allFieldDefs ?? [], {
      ...values,
      ...customFieldValues,
    });
    if (Object.keys(fieldErrors).length > 0) {
      const customKeys = new Set((customFieldDefs ?? []).map((f) => f.key));
      setCustomFieldErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).filter(([key]) => customKeys.has(key)),
        ),
      );
      toast.error(Object.values(fieldErrors).join(" "));
      return;
    }

    const payload = {
      ...values,
      dob: values.dob || undefined,
      altMobile: values.altMobile || undefined,
      email: values.email || undefined,
      maritalStatus: values.maritalStatus || undefined,
      bloodGroup: values.bloodGroup || undefined,
      customFields: customFieldValues,
    };

    try {
      await update.mutateAsync({ id: patient.id, payload });
      toast.success("Patient updated");
      cancelEditing();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save patient."));
    }
  };

  const onUploadDocument = async (file: File | null) => {
    if (!file || !id) return;
    try {
      await upload.mutateAsync({ patientId: id, file });
      toast.success("Document uploaded");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not upload document."));
    } finally {
      if (documentInputRef.current) documentInputRef.current.value = "";
    }
  };

  const onDeleteDocument = async (documentId: string) => {
    if (!id) return;
    try {
      await remove.mutateAsync({ id: documentId, patientId: id });
      toast.success("Document removed");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not remove document."));
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <button
        onClick={() => navigate("/patients")}
        className="no-print mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[var(--color-navy)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </button>

      <div className="no-print sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-2 bg-[var(--color-bg)]/95 px-1 py-2 backdrop-blur">
        {isEditing ? (
          <>
            <ActionButton
              onClick={handleSubmit(onSaveProfile)}
              disabled={isSubmitting}
              tone="primary"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </ActionButton>
            <ActionButton onClick={cancelEditing}>
              <X className="h-4 w-4" /> Cancel
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton onClick={onNewVisit} tone="primary">
              <Stethoscope className="h-4 w-4" /> New Visit
            </ActionButton>
            <ActionButton onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print Case Sheet
            </ActionButton>
            <ActionButton onClick={startEditing}>
              <Pencil className="h-4 w-4" /> Edit
            </ActionButton>
            <ActionButton
              onClick={() => setConfirmOpen(true)}
              tone={patient.isActive ? "danger" : "success"}
            >
              {patient.isActive ? (
                <>
                  <ShieldOff className="h-4 w-4" /> Deactivate
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Reactivate
                </>
              )}
            </ActionButton>
          </>
        )}
      </div>

      {hasAlerts && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-sm shadow-red-100/60">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-red-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-sm text-red-900">
            <p className="font-semibold">Clinical alerts</p>
            {patient.allergies && (
              <p className="mt-2">
                <span className="font-semibold">Allergies:</span>{" "}
                {patient.allergies}
              </p>
            )}
            {patient.chronicDiseases && (
              <p className="mt-1">
                <span className="font-semibold">Diseases/Conditions:</span>{" "}
                {patient.chronicDiseases}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start sm:p-5">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300 ring-1 ring-slate-200">
            <User className="h-8 w-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold leading-tight text-[var(--color-navy)]">
                {patient.name}
              </h1>
              {!patient.isActive && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                  Inactive
                </span>
              )}
              {latestCompliance && (
                <ComplianceBadge
                  percent={latestCompliance.overallPercent}
                  grade={latestCompliance.grade}
                />
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {patient.age} yrs | {GENDER_LABEL[patient.gender]} |{" "}
              {patient.patientId}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FactTile
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Mobile"
                value={patient.mobile}
              />
              {patient.bloodGroup && (
                <FactTile
                  icon={<Droplets className="h-3.5 w-3.5" />}
                  label="Blood group"
                  value={patient.bloodGroup}
                />
              )}
              {patient.city && (
                <FactTile
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="City"
                  value={patient.city}
                />
              )}
              {showStage && (
                <FactTile
                  icon={<BadgeCheck className="h-3.5 w-3.5" />}
                  label="Stage"
                  value={patient.stage}
                />
              )}
            </div>
          </div>

          {familyMembers.length > 0 && (
            <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm md:w-80 xl:w-96">
              <p className="mb-2 font-semibold text-[var(--color-navy)]">
                Family members
              </p>
              <div className="grid gap-2">
                {familyMembers.slice(0, 3).map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => navigate(`/patients/${member.id}`)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-[var(--color-primary)] hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">
                      {member.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {member.age} yrs | {GENDER_LABEL[member.gender]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(latestVisit || patient.nextFollowUp || latestCompliance) && (
      <div className={cn("mt-4 grid grid-cols-1 gap-4", latestVisit && "xl:grid-cols-[1.5fr_1fr]")}>
        {latestVisit && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-400">
                Doctor priority
              </p>
              <h2 className="text-lg font-semibold text-[var(--color-navy)]">
                Last visit summary
              </h2>
            </div>
          </div>
            <VisitCard
              visit={latestVisit}
              onView={() => setViewVisit(latestVisit)}
              onReprint={() => navigate(`/visits/${latestVisit.id}/prescription`)}
            />
        </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {patient.nextFollowUp && (
          <div
            className={cn(
              "rounded-xl border bg-white p-4 text-sm shadow-sm shadow-slate-200/40",
              nextFollowUpOverdue
                ? "border-red-200 bg-red-50/60 shadow-red-100/50"
                : "border-slate-200",
            )}
          >
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--color-navy)]">
              <CalendarDays className="h-4 w-4" /> Next follow-up
            </p>
            <p
              className={cn(
                "text-lg font-semibold",
                nextFollowUpOverdue ? "text-red-700" : "text-slate-800",
              )}
            >
              {nextFollowUpLabel}
            </p>
            {patient.nextFollowUp?.purpose && (
              <p className="mt-1 text-xs text-slate-500">
                {patient.nextFollowUp.purpose}
              </p>
            )}
          </div>
          )}

          {(latestCompliance || (history?.summary.totalVisits ?? patient.visitCount) > 0) && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/40">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--color-navy)]">
              <BadgeCheck className="h-4 w-4" /> Clinical status
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {history?.summary.totalVisits ?? patient.visitCount} visits
              </span>
              {latestCompliance ? (
                <ComplianceBadge
                  percent={latestCompliance.overallPercent}
                  grade={latestCompliance.grade}
                />
              ) : (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  No compliance record
                </span>
              )}
            </div>
            {history?.summary.mostPrescribedMedicines.length ? (
              <p className="mt-3 text-xs text-slate-500">
                Common medicines:{" "}
                {history.summary.mostPrescribedMedicines
                  .slice(0, 3)
                  .map((m) => m.medicineName)
                  .join(", ")}
              </p>
            ) : null}
          </div>
          )}
        </div>
      </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="no-print grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bills && bills.length > 0 && (
            <div className="order-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/40">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-[var(--color-navy)]">
                  Billing
                </p>
                <button
                  onClick={() => navigate("/billing")}
                  className="text-xs font-medium text-[var(--color-primary)]"
                >
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {bills.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-500">
                      {b.billNo} ·{" "}
                      {new Date(b.date).toLocaleDateString("en-IN")}
                    </span>
                    <span
                      className={
                        b.dueAmount > 0 && b.status !== "CANCELLED"
                          ? "font-medium text-red-600"
                          : "text-gray-600"
                      }
                    >
                      {b.dueAmount > 0 && b.status !== "CANCELLED"
                        ? `Due ₹${b.dueAmount.toLocaleString("en-IN")}`
                        : b.status === "CANCELLED"
                          ? "Cancelled"
                          : "Paid"}
                    </span>
                  </div>
                ))}
              </div>
              {(() => {
                const totalDue = bills
                  .filter((b) => b.status !== "CANCELLED")
                  .reduce((sum, b) => sum + b.dueAmount, 0);
                return totalDue > 0 ? (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-xs font-medium text-red-600">
                    Total outstanding: ₹{totalDue.toLocaleString("en-IN")}
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {upcomingAppointments && upcomingAppointments.length > 0 && (
            <div className="order-1 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/40">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--color-navy)]">
                <CalendarDays className="h-4 w-4" /> Upcoming Appointments
              </p>
              <div className="flex flex-col gap-1.5">
                {upcomingAppointments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("/appointments")}
                    className="flex items-center justify-between text-left text-xs hover:text-[var(--color-primary)]"
                  >
                    <span className="text-gray-600">
                      {new Date(a.appointmentDate).toLocaleDateString("en-IN")}
                    </span>
                    <span className="text-gray-400">{a.timeSlot}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {followUps && followUps.given > 0 && (
            <div className="order-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/40">
              <p className="mb-2 font-semibold text-[var(--color-navy)]">
                Follow-ups
              </p>
              <div className="flex justify-between text-gray-600">
                <span>{followUps.given} given</span>
                <span className="text-green-600">
                  {followUps.attended} attended
                </span>
                <span className="text-red-600">{followUps.missed} missed</span>
              </div>
            </div>
          )}

          {compliance && compliance.trend.length > 0 && (
            <div className="order-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/40">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-[var(--color-navy)]">
                  Compliance Trend
                </p>
                {compliance.lifetimeAverage !== null && (
                  <span className="text-xs text-gray-400">
                    Avg {compliance.lifetimeAverage}%
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {compliance.trend.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-500">
                      {new Date(record.recordedOn).toLocaleDateString("en-IN")}
                    </span>
                    <ComplianceBadge
                      percent={record.overallPercent}
                      grade={record.grade}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="no-print flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/40">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  tab === t
                    ? "bg-[var(--color-primary)] text-white shadow-sm shadow-[#1f3864]/10"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {t === "Profile" && <Layers className="h-3.5 w-3.5" />}
                {t}
              </button>
            ))}
          </div>

          {tab === "Profile" ? (
            isEditing ? (
              <form onSubmit={handleSubmit(onSaveProfile)}>
                <PatientFormFields
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                  coreFieldDefs={coreFieldDefs}
                />
                {(customFieldDefs?.length ?? 0) > 0 && (
                  <div className="mt-6">
                    <h2 className="mb-3 text-sm font-semibold text-[var(--color-navy)]">
                      Additional Details
                    </h2>
                    <PatientCustomFields
                      fields={customFieldDefs ?? []}
                      values={customFieldValues}
                      errors={customFieldErrors}
                      onChange={(key, value) => {
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [key]: value,
                        }));
                        setCustomFieldErrors((prev) => {
                          if (!prev[key]) return prev;
                          const { [key]: _removed, ...rest } = prev;
                          return rest;
                        });
                      }}
                    />
                  </div>
                )}
              </form>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm shadow-slate-200/40">
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <p>
                    <span className="text-gray-400">Address:</span>{" "}
                    {patient.address || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Alternate Mobile:</span>{" "}
                    {patient.altMobile || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Email:</span>{" "}
                    {patient.email || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Pincode:</span>{" "}
                    {patient.pincode || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Marital Status:</span>{" "}
                    {patient.maritalStatus || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Occupation:</span>{" "}
                    {patient.occupation || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Referred By:</span>{" "}
                    {patient.referredBy || "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Registered On:</span>{" "}
                    {new Date(patient.registeredOn).toLocaleDateString("en-IN")}
                  </p>
                  {patient.notes && (
                    <p className="sm:col-span-2">
                      <span className="text-gray-400">Notes:</span>{" "}
                      {patient.notes}
                    </p>
                  )}
                  {customFieldDefs
                    ?.filter(
                      (f) =>
                        f.isActive &&
                        String(patient.customFields?.[f.key] ?? "").trim(),
                    )
                    .map((f) => (
                      <p key={f.id}>
                        <span className="text-gray-400">{f.label}:</span>{" "}
                        {f.fieldType === "BOOLEAN"
                          ? patient.customFields[f.key] === "true"
                            ? "Yes"
                            : "No"
                          : patient.customFields[f.key]}
                      </p>
                    ))}
                </div>
              </div>
            )
          ) : tab === "Reports & Documents" ? (
            <div className="flex flex-col gap-3">
              <div className="no-print flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white p-4">
                <p className="text-sm text-gray-500">
                  Lab results, X-rays, prescriptions, and other patient files
                </p>
                <button
                  onClick={() => documentInputRef.current?.click()}
                  disabled={upload.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />{" "}
                  {upload.isPending ? "Uploading..." : "Upload"}
                </button>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) =>
                    onUploadDocument(e.target.files?.[0] ?? null)
                  }
                />
              </div>

              {reportVisits.length > 0 && (
                <div className="grid gap-3">
                  {reportVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[var(--color-navy)]">
                            {new Date(visit.visitDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-xs text-slate-400">{visit.visitNo}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewVisit(visit)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          View visit
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {visit.labTests.map((test) => (
                          <div
                            key={test.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-slate-700">{test.testName}</span>
                            <span className={test.status === "DONE" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                              {test.status === "DONE" && test.resultValue ? `${test.resultValue}${test.resultUnit ?? ""}` : test.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(history?.documents.length ?? 0) === 0 && reportVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
                  <Paperclip className="h-6 w-6 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">
                    No reports or documents added yet.
                  </p>
                </div>
              ) : (
                history?.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-sm"
                  >
                    <a
                      href={resolveServerUrl(doc.filePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 hover:opacity-80"
                    >
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {CATEGORY_LABEL[doc.category]} ·{" "}
                          {new Date(doc.uploadedOn).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </a>
                    <button
                      onClick={() => onDeleteDocument(doc.id)}
                      className="no-print text-gray-400 hover:text-red-600"
                      title="Remove document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <Stethoscope className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">
                No visits in this category yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredVisits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  onView={() => setViewVisit(visit)}
                  onReprint={() => navigate(`/visits/${visit.id}/prescription`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={
          patient.isActive
            ? `Deactivate ${patient.name}?`
            : `Reactivate ${patient.name}?`
        }
        description={
          patient.isActive
            ? "They'll be hidden from the active patient list. Their full record is kept and this can be undone any time."
            : "They will reappear in the active patient list immediately."
        }
        confirmLabel={patient.isActive ? "Deactivate" : "Reactivate"}
        destructive={patient.isActive}
        onConfirm={onToggleActive}
        onCancel={() => setConfirmOpen(false)}
      />

      {viewVisit && (
        <VisitSummaryModal
          visit={viewVisit}
          documents={history?.documents ?? []}
          onClose={() => setViewVisit(null)}
          onEdit={() => navigate(`/visits/${viewVisit.id}`)}
          onReprint={() => navigate(`/visits/${viewVisit.id}/prescription`)}
        />
      )}
    </div>
  );
}
