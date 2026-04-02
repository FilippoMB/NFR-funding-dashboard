import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#fbbf24', '#f87171'];

export default function AllocationPieChart({ items }) {
  // Format items for the pie chart
  const data = items.slice(0, 8).map(item => ({
    name: item.label,
    value: item.totalFundingNok
  }));

  const formatNOK = (value) => {
    if (value >= 1000000000) return `kr ${(value / 1000000000).toFixed(1)} mrd.`;
    if (value >= 1000000) return `kr ${(value / 1000000).toFixed(1)} mill.`;
    return `kr ${value.toLocaleString()}`;
  };

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
          <p style={{ color: "var(--color-accent)" }}>{formatNOK(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>No allocation visible</p>;
  }

  return (
    <div style={{ width: '100%', height: 440 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="40%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            iconType="circle"
            wrapperStyle={{
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
              paddingTop: '20px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
