import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "../../lib/formatters";

const COLORS = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#fbbf24', '#f87171'];

function formatMetricValue(value, variant) {
  if (variant === "currency") {
    return formatCompactCurrency(value);
  }

  if (variant === "decimal") {
    return formatDecimal(value);
  }

  return formatNumber(value);
}

export default function AllocationPieChart({
  items,
  emptyLabel = "No allocation visible",
  valueKey = "totalFundingNok",
  valueVariant = "currency"
}) {
  const data = items.slice(0, 8).map(item => ({
    name: item.label,
    value: item[valueKey] ?? 0
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "rgba(18, 24, 38, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          padding: "12px",
          borderRadius: "8px",
          color: "#f8fafc",
          fontSize: "0.85rem"
        }}>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>{payload[0].name}</p>
          <p style={{ color: "var(--color-accent)" }}>
            {formatMetricValue(payload[0].value, valueVariant)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{emptyLabel}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ width: '100%', height: 220, flexShrink: 0, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "8px", 
        marginTop: "16px",
        paddingLeft: "16%"
      }}>
        {data.map((entry, index) => (
          <div 
            key={`legend-item-${index}`} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              fontSize: "0.85rem", 
              color: "var(--color-text-secondary)",
              width: "100%"
            }}
          >
            <span 
              style={{ 
                display: "block", 
                width: "12px", 
                height: "12px", 
                borderRadius: "50%", 
                backgroundColor: COLORS[index % COLORS.length], 
                flexShrink: 0 
              }} 
            />
            <span 
              style={{ 
                whiteSpace: "nowrap", 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                flex: 1 
              }} 
              title={entry.name}
            >
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
