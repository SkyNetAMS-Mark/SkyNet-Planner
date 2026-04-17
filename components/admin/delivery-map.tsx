'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

interface DeliveryLocation {
  id: string
  lat: number
  lng: number
  title: string
  address: string
  tracking_number: string
  status: string
}

interface DeliveryMapProps {
  locations: DeliveryLocation[]
  height?: string
}

export function DeliveryMap({ locations, height = '500px' }: DeliveryMapProps) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!mapContainerRef.current || mapRef.current) return

    // Dynamically import Leaflet only on client side
    import('leaflet').then((L) => {
      // Fix for default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      // Initialize map
      const map = L.map(mapContainerRef.current!).setView([50.8503, 4.3517], 8)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // Add markers
      if (locations.length > 0) {
        const markers: any[] = []

        locations.forEach((location, index) => {
          const iconColor = location.status === 'delivered' ? 'green' :
                           location.status === 'in_transit' ? 'blue' : 'red'

          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                background-color: ${iconColor};
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
              ">
                ${index + 1}
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          })

          const marker = L.marker([location.lat, location.lng], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 200px;">
                <strong>${location.title}</strong><br/>
                <span style="font-family: monospace; font-size: 11px;">${location.tracking_number}</span><br/>
                <span style="font-size: 12px;">${location.address}</span><br/>
                <span style="font-size: 11px; color: #666;">Status: ${location.status}</span>
              </div>
            `)

          markers.push(marker)
        })

        // Fit bounds
        if (markers.length > 0) {
          const group = L.featureGroup(markers)
          map.fitBounds(group.getBounds().pad(0.1))
        }
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [locations])

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%', borderRadius: '8px' }}
      className="border shadow-sm"
    />
  )
}