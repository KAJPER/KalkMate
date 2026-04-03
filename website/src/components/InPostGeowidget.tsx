"use client";

import { useEffect, useRef } from "react";

export interface InPostPoint {
  name: string;
  type: string[];
  address: { line1: string; line2: string };
  address_details: {
    city: string;
    street: string;
    building_number: string;
    post_code: string;
  };
  location: { latitude: number; longitude: number };
  location_description: string;
  location_247: boolean;
  opening_hours: string;
  image_url: string;
}

interface InPostGeowidgetProps {
  token: string;
  onPointSelect: (point: InPostPoint) => void;
  height?: string;
}

const CALLBACK_NAME = "__inpostGeowidgetCallback";

export default function InPostGeowidget({
  token,
  onPointSelect,
  height = "440px",
}: InPostGeowidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPointSelectRef = useRef(onPointSelect);

  useEffect(() => {
    onPointSelectRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    if (!document.querySelector('link[href*="inpost-geowidget.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://geowidget.inpost.pl/inpost-geowidget.css";
      document.head.appendChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)[CALLBACK_NAME] = (
      point: InPostPoint
    ) => {
      onPointSelectRef.current(point);
    };

    const existingScript = document.querySelector(
      'script[src*="inpost-geowidget.js"]'
    );

    const initWidget = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      const widget = document.createElement("inpost-geowidget");
      widget.setAttribute("token", token);
      widget.setAttribute("language", "pl");
      widget.setAttribute("config", "parcelCollect");
      widget.setAttribute("onpoint", CALLBACK_NAME);

      containerRef.current.appendChild(widget);
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://geowidget.inpost.pl/inpost-geowidget.js";
      script.defer = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[CALLBACK_NAME];
    };
  }, [token]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
