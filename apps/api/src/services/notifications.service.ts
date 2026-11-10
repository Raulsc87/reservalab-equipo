interface ReservationNotification {
  id: string;
  userId: string;
  spaceId: string;
  purpose: string;
  startsAt: Date;
  endsAt: Date;
}

type ReservationEvent =
  | "reservation.confirmed"
  | "reservation.cancelled";

export async function notifyReservation(
  event: ReservationEvent,
  reservation: ReservationNotification
): Promise<boolean> {
  const baseUrl =
    process.env.NOTIFICATIONS_URL ??
    "http://127.0.0.1:3002";

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/notifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          event,
          occurredAt: new Date().toISOString(),
          reservation: {
            id: reservation.id,
            userId: reservation.userId,
            spaceId: reservation.spaceId,
            purpose: reservation.purpose,
            startsAt: reservation.startsAt.toISOString(),
            endsAt: reservation.endsAt.toISOString()
          }
        }),
        signal: AbortSignal.timeout(3000)
      }
    );

    if (response.status !== 202) {
      throw new Error(
        `El servicio respondio HTTP ${response.status}`
      );
    }

    console.info(
      "Notificacion aceptada:",
      event,
      reservation.id
    );

    return true;
  } catch (error) {
    console.error(
      "No se pudo enviar la notificacion:",
      event,
      reservation.id,
      error instanceof Error ? error.message : "Error desconocido"
    );

    return false;
  }
}